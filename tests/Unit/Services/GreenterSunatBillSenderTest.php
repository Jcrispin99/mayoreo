<?php

declare(strict_types=1);

use App\Models\FiscalDocument;
use App\Models\Product;
use App\Models\Productable;
use App\Models\Sale;
use App\Models\UnitOfMeasure;
use App\Services\GreenterSunatBillSender;
use Greenter\Model\Sale\Invoice;
use Greenter\Model\Sale\SaleDetail;
use Greenter\Xml\Builder\InvoiceBuilder;
use Tests\TestCase;

uses(TestCase::class);

it('builds every sale as exonerated without IGV', function (): void {
    $unit = (new UnitOfMeasure())->forceFill([
        'code' => 'kg',
        'name' => 'Kilogramos',
        'type' => 'weight',
    ]);
    $product = (new Product())->forceFill([
        'sku' => 'P001',
        'name' => 'Producto exonerado',
    ]);
    $product->setRelation('baseUnit', $unit);

    $item = (new Productable())->forceFill([
        'quantity' => '2.000000',
        'line_total' => '118.0000',
    ]);
    $item->setRelation('product', $product);

    $sale = (new Sale())->forceFill([
        'customer_name' => null,
        'customer_document' => null,
    ]);
    $sale->setRelation('items', collect([$item]));

    $document = (new FiscalDocument())->forceFill([
        'fiscal_issuer_id' => 1,
        'store_id' => 1,
        'issuer_ruc' => '20000000001',
        'issuer_legal_name' => 'EMPRESA PRUEBA SAC',
        'issuer_trade_name' => 'EMPRESA PRUEBA',
        'establishment_code' => '0000',
        'establishment_address' => 'AV. PRUEBA 123',
        'establishment_ubigeo' => '150101',
        'establishment_urbanization' => '-',
        'establishment_department' => 'LIMA',
        'establishment_province' => 'LIMA',
        'establishment_district' => 'LIMA',
        'document_type' => 'receipt',
        'series_code' => 'B001',
        'number' => 1,
        'issued_at' => now(),
    ]);
    $document->setRelation('sale', $sale);

    $method = new ReflectionMethod(GreenterSunatBillSender::class, 'makeInvoice');
    $invoice = $method->invoke(app(GreenterSunatBillSender::class), $document);

    expect($invoice)->toBeInstanceOf(Invoice::class)
        ->and($invoice->getMtoOperGravadas())->toBeNull()
        ->and($invoice->getMtoOperExoneradas())->toBe(118.0)
        ->and($invoice->getMtoIGV())->toBe(0.0)
        ->and($invoice->getTotalImpuestos())->toBe(0.0)
        ->and($invoice->getMtoImpVenta())->toBe(118.0);

    $detail = $invoice->getDetails()[0] ?? null;

    expect($detail)->toBeInstanceOf(SaleDetail::class)
        ->and($detail->getUnidad())->toBe('KGM')
        ->and($detail->getTipAfeIgv())->toBe('20')
        ->and($detail->getPorcentajeIgv())->toBe(0.0)
        ->and($detail->getIgv())->toBe(0.0)
        ->and($detail->getTotalImpuestos())->toBe(0.0)
        ->and($detail->getMtoValorVenta())->toBe(118.0)
        ->and($detail->getMtoPrecioUnitario())->toBe(59.0);

    $xml = (new InvoiceBuilder())->build($invoice);

    expect($xml)
        ->toContain('<cbc:TaxExemptionReasonCode>20</cbc:TaxExemptionReasonCode>')
        ->toContain('<cbc:Name>EXO</cbc:Name>')
        ->not->toContain('<cbc:TaxExemptionReasonCode>10</cbc:TaxExemptionReasonCode>');
});
