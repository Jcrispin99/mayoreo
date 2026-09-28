<?php

declare(strict_types=1);

namespace App\Services;

use App\Contracts\SunatBillSender;
use App\Data\SunatTransmissionResult;
use App\Enums\SunatEnvironment;
use App\Exceptions\SunatTransmissionException;
use App\Models\FiscalCredential;
use App\Models\FiscalDocument;
use App\Models\FiscalIssuer;
use App\Models\Product;
use App\Models\Productable;
use App\Models\Sale;
use App\Models\UnitOfMeasure;
use Greenter\Model\Client\Client;
use Greenter\Model\Company\Address;
use Greenter\Model\Company\Company;
use Greenter\Model\Response\BillResult;
use Greenter\Model\Sale\FormaPagos\FormaPagoContado;
use Greenter\Model\Sale\Invoice;
use Greenter\Model\Sale\Legend;
use Greenter\Model\Sale\Note;
use Greenter\Model\Sale\SaleDetail;
use Greenter\See;
use Greenter\Ws\Services\SunatEndpoints;
use NumberFormatter;

final readonly class GreenterSunatBillSender implements SunatBillSender
{
    private const string EXONERATED_IGV_AFFECTATION = '20';

    /**
     * Maps our internal unit codes to SUNAT's Catálogo 03 (Unidades de
     * Medida) codes. Internal codes stay as-is elsewhere (conversions, POS,
     * product forms all key off them) — only the SUNAT wire format differs.
     *
     * @var array<string, string>
     */
    private const array SUNAT_UNIT_CODES = [
        'kg' => 'KGM',
    ];

    public function __construct(
        private FiscalCertificateService $certificateService,
    ) {}

    public function send(FiscalDocument $document): SunatTransmissionResult
    {
        $document->loadMissing([
            'fiscalIssuer.credential',
            'sale.items.product.baseUnit',
            'affectedDocument',
        ]);

        $issuer = $document->fiscalIssuer;
        $credential = $issuer?->credential;

        if (! $issuer instanceof FiscalIssuer
            || ! $credential instanceof FiscalCredential
            || ! $credential->configurationIsComplete()) {
            throw SunatTransmissionException::missingCredentials();
        }

        $see = $this->makeSee($document, $credential);
        $sunatDocument = $document->document_type === 'credit_note'
            ? $this->makeNote($document)
            : $this->makeInvoice($document);
        $result = $see->send($sunatDocument);
        $xml = $see->getFactory()->getLastXml();

        if (! is_string($xml) || $xml === '') {
            throw SunatTransmissionException::transportFailure(
                'Greenter no devolvió el XML firmado.',
            );
        }

        if (! $result instanceof BillResult || $result->isSuccess() !== true) {
            return new SunatTransmissionResult(
                xml: $xml,
                cdrZip: null,
                status: 'error',
                errorCode: $result?->getError()?->getCode(),
                errorMessage: $result?->getError()?->getMessage()
                    ?? 'SUNAT no devolvió una respuesta válida.',
            );
        }

        $cdr = $result->getCdrResponse();

        if ($cdr === null) {
            return new SunatTransmissionResult(
                xml: $xml,
                cdrZip: $result->getCdrZip(),
                status: 'error',
                errorMessage: 'SUNAT respondió sin un CDR legible.',
            );
        }

        $code = (int) $cdr->getCode();
        $notes = $cdr->getNotes() ?? [];
        $status = match (true) {
            $code === 0 && $notes === [] => 'accepted',
            $code === 0 || $code >= 4000 => 'observed',
            $code >= 2000 => 'rejected',
            default => 'error',
        };

        return new SunatTransmissionResult(
            xml: $xml,
            cdrZip: $result->getCdrZip(),
            status: $status,
            cdrCode: $cdr->getCode(),
            cdrDescription: $cdr->getDescription(),
            notes: array_values($notes),
        );
    }

    private function makeSee(
        FiscalDocument $document,
        FiscalCredential $credential,
    ): See {
        $see = new See();
        $see->setCertificate($this->certificateService->contents($credential));
        $see->setService(
            $credential->environment === SunatEnvironment::Production
                ? SunatEndpoints::FE_PRODUCCION
                : SunatEndpoints::FE_BETA,
        );
        $see->setClaveSOL(
            (string) $document->issuer_ruc,
            (string) $credential->sol_username,
            (string) $credential->sol_password,
        );

        return $see;
    }

    private function makeInvoice(FiscalDocument $document): Invoice
    {
        if (! $document->hasFiscalIdentitySnapshot()) {
            throw SunatTransmissionException::missingIdentity();
        }

        $sale = $document->sale;

        if (! $sale instanceof Sale) {
            throw SunatTransmissionException::emptySale();
        }

        $items = $sale->items;

        if ($items->isEmpty()) {
            throw SunatTransmissionException::emptySale();
        }

        $client = $this->makeClient(
            $document->document_type,
            $sale->customer_document,
            $sale->customer_name,
        );
        $details = [];
        $exonerated = 0.0;

        foreach ($items as $item) {
            $detail = $this->makeDetail($item);
            $details[] = $detail;
            $exonerated += (float) $detail->getMtoValorVenta();
        }

        $exonerated = round($exonerated, 2);

        return (new Invoice())
            ->setUblVersion('2.1')
            ->setTipoOperacion('0101')
            ->setTipoDoc($document->document_type === 'invoice' ? '01' : '03')
            ->setSerie($document->series_code)
            ->setCorrelativo((string) $document->number)
            ->setFechaEmision($document->issued_at->toDateTimeImmutable())
            ->setFormaPago(new FormaPagoContado())
            ->setTipoMoneda('PEN')
            ->setCompany($this->makeCompany($document))
            ->setClient($client)
            ->setMtoOperExoneradas($exonerated)
            ->setMtoIGV(0.0)
            ->setTotalImpuestos(0.0)
            ->setValorVenta($exonerated)
            ->setSubTotal($exonerated)
            ->setMtoImpVenta($exonerated)
            ->setDetails($details)
            ->setLegends([
                (new Legend())
                    ->setCode('1000')
                    ->setValue($this->amountInWords($exonerated)),
            ]);
    }

    private function makeNote(FiscalDocument $document): Note
    {
        if (! $document->hasFiscalIdentitySnapshot()) {
            throw SunatTransmissionException::missingIdentity();
        }

        $sale = $document->sale;
        $affected = $document->affectedDocument;

        if (! $sale instanceof Sale || ! $affected instanceof FiscalDocument) {
            throw SunatTransmissionException::emptySale();
        }

        $items = $document->credit_note_items ?? [];

        if ($items === []) {
            throw SunatTransmissionException::emptySale();
        }

        $client = $this->makeClient(
            $affected->document_type,
            $sale->customer_document,
            $sale->customer_name,
        );
        $details = [];
        $exonerated = 0.0;

        foreach ($items as $item) {
            $detail = $this->makeSaleDetail(
                (string) $item['product_sku'],
                (string) $item['unit_code'],
                (string) $item['product_name'],
                (float) $item['quantity'],
                round((float) $item['line_total'], 2),
            );
            $details[] = $detail;
            $exonerated += (float) $detail->getMtoValorVenta();
        }

        $exonerated = round($exonerated, 2);

        return (new Note())
            ->setUblVersion('2.1')
            ->setTipoDoc('07')
            ->setSerie($document->series_code)
            ->setCorrelativo((string) $document->number)
            ->setFechaEmision($document->issued_at->toDateTimeImmutable())
            ->setTipoMoneda('PEN')
            ->setCompany($this->makeCompany($document))
            ->setClient($client)
            ->setCodMotivo((string) $document->reason_code)
            ->setDesMotivo((string) $document->reason_description)
            ->setTipDocAfectado($affected->document_type === 'invoice' ? '01' : '03')
            ->setNumDocfectado($affected->series_code.'-'.$affected->number)
            ->setMtoOperExoneradas($exonerated)
            ->setMtoIGV(0.0)
            ->setTotalImpuestos(0.0)
            ->setValorVenta($exonerated)
            ->setSubTotal($exonerated)
            ->setMtoImpVenta($exonerated)
            ->setDetails($details)
            ->setLegends([
                (new Legend())
                    ->setCode('1000')
                    ->setValue($this->amountInWords($exonerated)),
            ]);
    }

    private function makeCompany(FiscalDocument $document): Company
    {
        $address = (new Address())
            ->setUbigueo($document->establishment_ubigeo)
            ->setDepartamento($document->establishment_department)
            ->setProvincia($document->establishment_province)
            ->setDistrito($document->establishment_district)
            ->setUrbanizacion($document->establishment_urbanization ?: '-')
            ->setDireccion($document->establishment_address)
            ->setCodLocal($document->establishment_code);

        return (new Company())
            ->setRuc($document->issuer_ruc)
            ->setRazonSocial($document->issuer_legal_name)
            ->setNombreComercial($document->issuer_trade_name ?: $document->issuer_legal_name)
            ->setAddress($address);
    }

    private function makeClient(
        string $documentType,
        ?string $documentNumber,
        ?string $name,
    ): Client {
        $documentNumber = mb_trim((string) $documentNumber);
        $name = mb_trim((string) $name);

        if ($documentType === 'invoice') {
            if (preg_match('/^\d{11}$/D', $documentNumber) !== 1 || $name === '') {
                throw SunatTransmissionException::invalidCustomer(
                    'Una factura requiere RUC de 11 dígitos y razón social.',
                );
            }

            return (new Client())
                ->setTipoDoc('6')
                ->setNumDoc($documentNumber)
                ->setRznSocial($name);
        }

        if ($documentNumber === '') {
            return (new Client())
                ->setTipoDoc('0')
                ->setNumDoc('-')
                ->setRznSocial($name ?: 'CLIENTES VARIOS');
        }

        $type = match (true) {
            preg_match('/^\d{8}$/D', $documentNumber) === 1 => '1',
            preg_match('/^\d{11}$/D', $documentNumber) === 1 => '6',
            default => throw SunatTransmissionException::invalidCustomer(
                'La boleta requiere DNI de 8 dígitos, RUC de 11 dígitos o consumidor final.',
            ),
        };

        return (new Client())
            ->setTipoDoc($type)
            ->setNumDoc($documentNumber)
            ->setRznSocial($name ?: 'CLIENTE');
    }

    private function makeDetail(Productable $item): SaleDetail
    {
        $product = $item->product;
        $baseUnit = $product?->baseUnit;

        if (! $product instanceof Product || ! $baseUnit instanceof UnitOfMeasure) {
            throw SunatTransmissionException::emptySale();
        }

        return $this->makeSaleDetail(
            $product->sku,
            $baseUnit->code,
            $product->name,
            (float) $item->quantity,
            round((float) $item->line_total, 2),
        );
    }

    private function makeSaleDetail(
        string $sku,
        string $unitCode,
        string $description,
        float $quantity,
        float $inclusiveTotal,
    ): SaleDetail {
        if ($quantity <= 0 || $inclusiveTotal < 0) {
            throw SunatTransmissionException::emptySale();
        }

        $exonerated = round($inclusiveTotal, 2);

        return (new SaleDetail())
            ->setCodProducto($sku)
            ->setUnidad(self::SUNAT_UNIT_CODES[$unitCode] ?? $unitCode)
            ->setCantidad($quantity)
            ->setDescripcion($description)
            ->setMtoBaseIgv($exonerated)
            ->setPorcentajeIgv(0.0)
            ->setIgv(0.0)
            ->setTipAfeIgv(self::EXONERATED_IGV_AFFECTATION)
            ->setTotalImpuestos(0.0)
            ->setMtoValorVenta($exonerated)
            ->setMtoValorUnitario(round($exonerated / $quantity, 10))
            ->setMtoPrecioUnitario(round($exonerated / $quantity, 10));
    }

    private function amountInWords(float $amount): string
    {
        $whole = (int) floor($amount);
        $cents = (int) round(($amount - $whole) * 100);
        $formatter = new NumberFormatter('es_PE', NumberFormatter::SPELLOUT);
        $words = $formatter->format($whole);

        return sprintf(
            'SON %s CON %02d/100 SOLES',
            mb_strtoupper(is_string($words) ? $words : (string) $whole),
            $cents,
        );
    }
}
