<?php

declare(strict_types=1);

namespace App\Console\Commands;

use DateTimeImmutable;
use DateTimeZone;
use Greenter\Model\Client\Client;
use Greenter\Model\Company\Address;
use Greenter\Model\Company\Company;
use Greenter\Model\Response\BillResult;
use Greenter\Model\Sale\FormaPagos\FormaPagoContado;
use Greenter\Model\Sale\Invoice;
use Greenter\Model\Sale\Legend;
use Greenter\Model\Sale\SaleDetail;
use Greenter\See;
use Greenter\Ws\Services\SunatEndpoints;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

final class SendSunatBetaSmoke extends Command
{
    protected $signature = 'fiscal:sunat-beta-smoke
        {certificate : Ruta de un certificado PEM con clave privada}
        {--series=B001 : Serie de boleta}
        {--number= : Correlativo; por defecto se genera uno con la hora actual}';

    protected $description = 'Envía una boleta mínima al entorno beta público de SUNAT';

    public function handle(): int
    {
        $certificatePath = $this->argument('certificate');

        if (! is_file($certificatePath)) {
            $this->error('No se encontró el certificado PEM indicado.');

            return self::FAILURE;
        }

        $certificate = file_get_contents($certificatePath);

        if (! is_string($certificate) || $certificate === '') {
            $this->error('No se pudo leer el certificado PEM.');

            return self::FAILURE;
        }

        $series = mb_strtoupper((string) $this->option('series'));
        $numberOption = $this->option('number');
        $number = is_numeric($numberOption)
            ? (int) $numberOption
            : (int) (now('America/Lima')->format('His').random_int(10, 99));

        if ($number < 1 || $number > 99999999) {
            $this->error('El correlativo debe estar entre 1 y 99999999.');

            return self::FAILURE;
        }

        $invoice = $this->makeInvoice($series, $number);
        $see = new See();
        $see->setCertificate($certificate);
        $see->setService(SunatEndpoints::FE_BETA);
        $see->setClaveSOL('20000000001', 'MODDATOS', 'moddatos');

        $this->info(sprintf('Enviando boleta beta %s-%d...', $series, $number));
        $result = $see->send($invoice);
        $xml = $see->getFactory()->getLastXml();

        if (is_string($xml)) {
            Storage::disk('local')->put(
                sprintf('sunat-beta-smoke/20000000001-03-%s-%d.xml', $series, $number),
                $xml,
            );
        }

        if (! $result instanceof BillResult || $result->isSuccess() !== true) {
            $this->error(sprintf(
                'SUNAT/Greenter error [%s]: %s',
                $result?->getError()?->getCode() ?? 'sin-código',
                $result?->getError()?->getMessage() ?? 'respuesta inválida',
            ));

            return self::FAILURE;
        }

        $cdr = $result->getCdrResponse();

        if ($cdr === null) {
            $this->error('SUNAT respondió sin CDR.');

            return self::FAILURE;
        }

        $cdrZip = $result->getCdrZip();

        if (is_string($cdrZip)) {
            Storage::disk('local')->put(
                sprintf('sunat-beta-smoke/R-20000000001-03-%s-%d.zip', $series, $number),
                $cdrZip,
            );
        }

        $this->line(sprintf('CDR [%s]: %s', $cdr->getCode(), $cdr->getDescription()));

        foreach ($cdr->getNotes() ?? [] as $note) {
            $this->warn('Observación: '.$note);
        }

        return (int) $cdr->getCode() === 0 ? self::SUCCESS : self::FAILURE;
    }

    private function makeInvoice(string $series, int $number): Invoice
    {
        $client = (new Client())
            ->setTipoDoc('1')
            ->setNumDoc('46712369')
            ->setRznSocial('MARIA RAMOS ARTEAGA');
        $address = (new Address())
            ->setUbigueo('150101')
            ->setDepartamento('LIMA')
            ->setProvincia('LIMA')
            ->setDistrito('LIMA')
            ->setUrbanizacion('-')
            ->setDireccion('AV. PRUEBA SUNAT 123')
            ->setCodLocal('0000');
        $company = (new Company())
            ->setRuc('20000000001')
            ->setRazonSocial('EMPRESA DE PRUEBA SUNAT')
            ->setNombreComercial('PRUEBA SUNAT')
            ->setAddress($address);
        $detail = (new SaleDetail())
            ->setCodProducto('P001')
            ->setUnidad('NIU')
            ->setCantidad(1)
            ->setDescripcion('PRODUCTO DE PRUEBA')
            ->setMtoBaseIgv(100.00)
            ->setPorcentajeIgv(18.00)
            ->setIgv(18.00)
            ->setTipAfeIgv('10')
            ->setTotalImpuestos(18.00)
            ->setMtoValorVenta(100.00)
            ->setMtoValorUnitario(100.00)
            ->setMtoPrecioUnitario(118.00);
        $legend = (new Legend())
            ->setCode('1000')
            ->setValue('SON CIENTO DIECIOCHO CON 00/100 SOLES');

        return (new Invoice())
            ->setUblVersion('2.1')
            ->setTipoOperacion('0101')
            ->setTipoDoc('03')
            ->setSerie($series)
            ->setCorrelativo((string) $number)
            ->setFechaEmision(new DateTimeImmutable('now', new DateTimeZone('America/Lima')))
            ->setFormaPago(new FormaPagoContado())
            ->setTipoMoneda('PEN')
            ->setCompany($company)
            ->setClient($client)
            ->setMtoOperGravadas(100.00)
            ->setMtoIGV(18.00)
            ->setTotalImpuestos(18.00)
            ->setValorVenta(100.00)
            ->setSubTotal(118.00)
            ->setMtoImpVenta(118.00)
            ->setDetails([$detail])
            ->setLegends([$legend]);
    }
}
