<?php

declare(strict_types=1);

use App\Jobs\SendFiscalDocumentToSunat;
use App\Models\DocumentSeries;
use App\Models\FiscalIssuer;
use App\Models\HistoricalSaleImport;
use App\Models\PriceTier;
use App\Models\Product;
use App\Models\Store;
use App\Models\UnitOfMeasure;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\StockLedgerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Storage::fake('local');
    Queue::fake();

    $this->user = User::factory()->create();
    grantApiPermissions($this->user, 'sales.manage');
    $this->issuer = FiscalIssuer::factory()->create();
    $this->store = Store::factory()->for($this->issuer, 'fiscalIssuer')->create([
        'sunat_establishment_code' => '0001',
        'sunat_address' => 'Av. Histórica 123',
        'sunat_ubigeo' => '150101',
        'sunat_department' => 'Lima',
        'sunat_province' => 'Lima',
        'sunat_district' => 'Lima',
    ]);
    $this->warehouse = Warehouse::factory()->for($this->store)->create();
    $this->operationalSeries = DocumentSeries::factory()->for($this->issuer, 'fiscalIssuer')->create([
        'document_type' => 'sales_ticket',
        'series_code' => 'T001',
        'purpose' => 'operational',
        'current_number' => 40,
    ]);
    $this->historicalSeries = DocumentSeries::factory()->for($this->issuer, 'fiscalIssuer')->create([
        'document_type' => 'receipt',
        'series_code' => 'B901',
        'purpose' => 'historical_import',
        'current_number' => 0,
    ]);
    $this->receiptSeries = DocumentSeries::factory()->for($this->issuer, 'fiscalIssuer')->create([
        'document_type' => 'receipt',
        'series_code' => 'B001',
        'purpose' => 'operational',
        'current_number' => 12,
    ]);
    $this->product = Product::factory()->create([
        'name' => 'Arroz a granel',
        'sale_mode' => 'measured',
        'is_principal' => true,
    ]);
    PriceTier::factory()->for($this->product)->create([
        'min_quantity' => 0,
        'max_quantity' => null,
        'unit_price' => '10.0000',
    ]);
    app(StockLedgerService::class)->registerIn(
        $this->product,
        $this->warehouse,
        '100.000000',
        '5.0000',
        'purchase',
    );
});

it('protects the historical sales module with the sales manage permission', function (): void {
    $unauthorized = User::factory()->create();

    $this->actingAs($unauthorized)
        ->get('/historical-sales')
        ->assertForbidden();
});

it('loads an excel file and creates a preview without consuming correlatives', function (): void {
    $response = $this->actingAs($this->user)->post('/historical-sales', [
        'warehouse_id' => $this->warehouse->id,
        'document_series_id' => $this->historicalSeries->id,
        'file' => historicalSalesSpreadsheet([
            ['10/08/2026', '11:25', '25.00'],
            ['11/08/2026', '09:10', '30.00'],
        ]),
    ]);

    $import = HistoricalSaleImport::query()->firstOrFail();
    $response->assertRedirect("/historical-sales/{$import->id}");

    expect($import->status)->toBe('ready')
        ->and($import->total_rows)->toBe(2)
        ->and($import->ready_rows)->toBe(2)
        ->and($import->expected_total)->toBe('55.00')
        ->and($import->rows()->firstOrFail()->proposed_items)->not->toBeEmpty();

    expect($this->historicalSeries->fresh()->purpose)->toBe('historical_import')
        ->and($this->historicalSeries->fresh()->current_number)->toBe(0)
        ->and($this->operationalSeries->fresh()->current_number)->toBe(40);
});

it('confirms rows chronologically as new receipts with Yape payments and exact totals', function (): void {
    $this->actingAs($this->user)->post('/historical-sales', [
        'warehouse_id' => $this->warehouse->id,
        'document_series_id' => $this->historicalSeries->id,
        'file' => historicalSalesSpreadsheet([
            ['11/08/2026', '09:10', '30.00'],
            ['10/08/2026', '11:25', '25.00'],
        ]),
    ])->assertRedirect();

    $import = HistoricalSaleImport::query()->firstOrFail();

    $this->actingAs($this->user)
        ->post("/historical-sales/{$import->id}/confirm")
        ->assertRedirect();

    $import->refresh();
    $sales = $import->rows()->with('sale.fiscalDocuments', 'sale.payments')->orderBy('sold_at')->get();

    Queue::assertPushed(SendFiscalDocumentToSunat::class, 2);

    expect($import->status)->toBe('completed')
        ->and($import->imported_rows)->toBe(2)
        ->and($import->imported_total)->toBe('55.00')
        ->and($this->historicalSeries->fresh()->current_number)->toBe(2)
        ->and($this->operationalSeries->fresh()->current_number)->toBe(40)
        ->and($sales[0]->sale?->source)->toBe('historical_import')
        ->and($sales[0]->sale?->sold_at->copy()->setTimezone('America/Lima')->format('Y-m-d H:i'))->toBe('2026-08-10 11:25')
        ->and($sales[0]->sale?->payable_total)->toBe('25.00')
        ->and($sales[0]->sale?->payments)->toHaveCount(1)
        ->and($sales[0]->sale?->payments->first()?->method)->toBe('yape')
        ->and($sales[0]->sale?->payments->first()?->reference)->toContain('Cliente Uno*')
        ->and($sales[0]->sale?->fiscalDocuments->first()?->document_type)->toBe('receipt')
        ->and($sales[0]->sale?->fiscalDocuments->first()?->number)->toBe(1)
        ->and($sales[1]->sale?->fiscalDocuments->first()?->number)->toBe(2);

    $this->assertDatabaseCount('sales', 2);
    $this->assertDatabaseCount('sale_payments', 2);
    $this->assertDatabaseCount('fiscal_documents', 2);
});

it('shows the SUNAT response for every imported receipt', function (): void {
    $this->actingAs($this->user)->post('/historical-sales', [
        'warehouse_id' => $this->warehouse->id,
        'document_series_id' => $this->historicalSeries->id,
        'file' => historicalSalesSpreadsheet([
            ['10/08/2026', '11:25', '25.00'],
        ]),
    ])->assertRedirect();

    $import = HistoricalSaleImport::query()->firstOrFail();
    $this->actingAs($this->user)->post("/historical-sales/{$import->id}/confirm")->assertRedirect();
    $document = $import->rows()->with('sale.fiscalDocuments')->firstOrFail()->sale?->fiscalDocuments->firstOrFail();
    assert($document !== null);
    $document->update([
        'sunat_status' => 'accepted',
        'sunat_attempts' => 1,
        'cdr_code' => '0',
        'cdr_description' => 'La boleta ha sido aceptada.',
        'xml_path' => 'documents/test.xml',
        'cdr_path' => 'documents/test-cdr.zip',
        'sunat_sent_at' => now(),
        'sunat_responded_at' => now(),
    ]);

    $this->actingAs($this->user)
        ->get("/historical-sales/{$import->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page): Assert => $page
            ->component('historical-sales/show')
            ->where('import.rows.0.document_number', 'B901-00000001')
            ->where('import.rows.0.sunat.status', 'accepted')
            ->where('import.rows.0.sunat.attempts', 1)
            ->where('import.rows.0.sunat.cdr_code', '0')
            ->where('import.rows.0.sunat.cdr_description', 'La boleta ha sido aceptada.')
            ->where('import.rows.0.sunat.has_xml', true)
            ->where('import.rows.0.sunat.has_cdr', true));
});

it('imports only TE PAGÓ operations and preserves their Yape data', function (): void {
    $this->actingAs($this->user)->post('/historical-sales', [
        'warehouse_id' => $this->warehouse->id,
        'document_series_id' => $this->historicalSeries->id,
        'file' => yapeSpreadsheet([
            ['PAGASTE', 'Jhamil Cri*', 'Alhi Cri*', '50.00', '', '14/08/2026 18:16:03'],
            ['TE PAGÓ', 'Percy Cam*', 'Jhamil Cri*', '56.00', 'Pedido 123', '07/08/2026 04:36:41'],
        ]),
    ])->assertRedirect();

    $import = HistoricalSaleImport::query()->firstOrFail();
    $row = $import->rows()->firstOrFail();

    expect($import->total_rows)->toBe(1)
        ->and($import->ready_rows)->toBe(1)
        ->and($row->row_number)->toBe(7)
        ->and($row->transaction_type)->toBe('TE PAGÓ')
        ->and($row->origin)->toBe('Percy Cam*')
        ->and($row->destination)->toBe('Jhamil Cri*')
        ->and($row->message)->toBe('Pedido 123')
        ->and($row->expected_total)->toBe('56.00')
        ->and($row->sold_at?->copy()->setTimezone('America/Lima')->format('d/m/Y H:i:s'))->toBe('07/08/2026 04:36:41');
});

it('rejects an export that contains no TE PAGÓ operations', function (): void {
    $this->actingAs($this->user)
        ->from('/historical-sales/create')
        ->post('/historical-sales', [
            'warehouse_id' => $this->warehouse->id,
            'document_series_id' => $this->historicalSeries->id,
            'file' => yapeSpreadsheet([
                ['PAGASTE', 'Jhamil Cri*', 'Alhi Cri*', '50.00', '', '14/08/2026 18:16:03'],
            ]),
        ])
        ->assertRedirect('/historical-sales/create')
        ->assertSessionHasErrors('file');

    $this->assertDatabaseCount('historical_sale_imports', 0);
});

it('keeps Yape payments of S/ 700 or more observed and does not create receipts for them', function (): void {
    $this->actingAs($this->user)->post('/historical-sales', [
        'warehouse_id' => $this->warehouse->id,
        'document_series_id' => $this->historicalSeries->id,
        'file' => yapeSpreadsheet([
            ['TE PAGÓ', 'Cliente Uno*', 'Jhamil Cri*', '699.99', '', '14/08/2026 10:00:00'],
            ['TE PAGÓ', 'Cliente Dos*', 'Jhamil Cri*', '700.00', '', '14/08/2026 10:01:00'],
            ['TE PAGÓ', 'Cliente Tres*', 'Jhamil Cri*', '701.00', '', '14/08/2026 10:02:00'],
        ]),
    ])->assertRedirect();

    $import = HistoricalSaleImport::query()->firstOrFail();

    expect($import->total_rows)->toBe(3)
        ->and($import->ready_rows)->toBe(1)
        ->and($import->failed_rows)->toBe(2)
        ->and($import->rows()->where('status', 'invalid')->pluck('error_message')->all())
        ->each->toContain('S/ 700.00 o más');

    $this->actingAs($this->user)->post("/historical-sales/{$import->id}/confirm")->assertRedirect();

    expect($import->fresh()->imported_rows)->toBe(1)
        ->and($import->rows()->whereNotNull('sale_id')->count())->toBe(1)
        ->and($this->historicalSeries->fresh()->current_number)->toBe(1);
});

it('proposes more products as the Yape payment amount grows when stock is available', function (): void {
    $unit = UnitOfMeasure::query()->firstOrCreate(
        ['code' => 'NIU'],
        ['name' => 'Unidades', 'type' => 'count'],
    );

    foreach ([10, 15] as $index => $price) {
        $product = Product::factory()->create([
            'name' => 'Producto unitario '.($index + 1),
            'base_unit_id' => $unit->id,
            'sale_mode' => 'unit',
            'is_principal' => true,
        ]);
        PriceTier::factory()->for($product)->create([
            'min_quantity' => 0,
            'max_quantity' => null,
            'unit_price' => number_format($price, 4, '.', ''),
        ]);
        app(StockLedgerService::class)->registerIn($product, $this->warehouse, '20.000000', '5.0000', 'purchase');
    }

    $this->actingAs($this->user)->post('/historical-sales', [
        'warehouse_id' => $this->warehouse->id,
        'document_series_id' => $this->historicalSeries->id,
        'file' => historicalSalesSpreadsheet([
            ['10/08/2026', '11:25', '56.00'],
        ]),
    ])->assertRedirect();

    expect(HistoricalSaleImport::query()->firstOrFail()->rows()->firstOrFail()->proposed_items)->toHaveCount(3);
});

it('proposes and imports historical sales when warehouse stock is negative', function (): void {
    $retailWarehouse = Warehouse::factory()->for($this->store)->retail()->create();
    app(StockLedgerService::class)->registerOut(
        $this->product,
        $retailWarehouse,
        '2.000000',
        'sale',
    );

    $this->actingAs($this->user)->post('/historical-sales', [
        'warehouse_id' => $retailWarehouse->id,
        'document_series_id' => $this->historicalSeries->id,
        'file' => historicalSalesSpreadsheet([
            ['10/08/2026', '11:25', '13.00'],
        ]),
    ])->assertRedirect();

    $import = HistoricalSaleImport::query()->firstOrFail();
    $row = $import->rows()->firstOrFail();
    $proposedQuantity = $row->proposed_items[0]['quantity'] ?? null;
    assert(is_string($proposedQuantity));

    expect($row->status)->toBe('ready')
        ->and($row->proposed_items)->toHaveCount(1)
        ->and($proposedQuantity)->toBeString()
        ->and(preg_match('/^1\.\d*[1-9]\d*$/', $proposedQuantity))->toBe(1);

    $this->actingAs($this->user)
        ->post("/historical-sales/{$import->id}/confirm")
        ->assertRedirect();

    Queue::assertPushed(SendFiscalDocumentToSunat::class, 1);

    /** @var numeric-string $proposedQuantity */
    $expectedStock = bcsub('-2.000000', $proposedQuantity, 6);

    expect($row->fresh()->status)->toBe('imported')
        ->and($retailWarehouse->stocks()->where('product_id', $this->product->id)->firstOrFail()->quantity)
        ->toBe($expectedStock);
});

it('rejects uploading the same file twice for one warehouse', function (): void {
    $rows = [['10/08/2026', '11:25', '25.00']];

    $this->actingAs($this->user)->post('/historical-sales', [
        'warehouse_id' => $this->warehouse->id,
        'document_series_id' => $this->historicalSeries->id,
        'file' => historicalSalesSpreadsheet($rows),
    ])->assertRedirect();

    $this->actingAs($this->user)
        ->from('/historical-sales/create')
        ->post('/historical-sales', [
            'warehouse_id' => $this->warehouse->id,
            'document_series_id' => $this->historicalSeries->id,
            'file' => historicalSalesSpreadsheet($rows),
        ])
        ->assertRedirect('/historical-sales/create')
        ->assertSessionHasErrors('file');

    $this->assertDatabaseCount('historical_sale_imports', 1);
});

it('uses a configured receipt series and advances only its real correlative', function (): void {
    $this->actingAs($this->user)->post('/historical-sales', [
        'warehouse_id' => $this->warehouse->id,
        'document_series_id' => $this->receiptSeries->id,
        'file' => historicalSalesSpreadsheet([
            ['10/08/2026', '11:25', '25.00'],
        ]),
    ])->assertRedirect();

    $import = HistoricalSaleImport::query()->firstOrFail();

    $this->actingAs($this->user)
        ->post("/historical-sales/{$import->id}/confirm")
        ->assertRedirect();

    $document = $import->rows()->with('sale.fiscalDocuments')->firstOrFail()->sale?->fiscalDocuments->first();

    expect($import->fresh()->status)->toBe('completed')
        ->and($this->receiptSeries->fresh()->current_number)->toBe(13)
        ->and($this->historicalSeries->fresh()->current_number)->toBe(0)
        ->and($this->operationalSeries->fresh()->current_number)->toBe(40)
        ->and($document?->document_type)->toBe('receipt')
        ->and($document?->series_code)->toBe('B001')
        ->and($document?->number)->toBe(13)
        ->and($document?->status)->toBe('issued');
});

it('rejects a series belonging to another fiscal issuer', function (): void {
    $otherIssuer = FiscalIssuer::factory()->create();
    $otherSeries = DocumentSeries::factory()->for($otherIssuer, 'fiscalIssuer')->create([
        'document_type' => 'receipt',
        'series_code' => 'B999',
    ]);

    $this->actingAs($this->user)
        ->from('/historical-sales/create')
        ->post('/historical-sales', [
            'warehouse_id' => $this->warehouse->id,
            'document_series_id' => $otherSeries->id,
            'file' => historicalSalesSpreadsheet([
                ['10/08/2026', '11:25', '25.00'],
            ]),
        ])
        ->assertRedirect('/historical-sales/create')
        ->assertSessionHasErrors('document_series_id');

    $this->assertDatabaseCount('historical_sale_imports', 0);
});

it('rejects a non-receipt series for Yape imports', function (): void {
    $this->actingAs($this->user)
        ->from('/historical-sales/create')
        ->post('/historical-sales', [
            'warehouse_id' => $this->warehouse->id,
            'document_series_id' => $this->operationalSeries->id,
            'file' => historicalSalesSpreadsheet([
                ['10/08/2026', '11:25', '25.00'],
            ]),
        ])
        ->assertRedirect('/historical-sales/create')
        ->assertSessionHasErrors('document_series_id');

    $this->assertDatabaseCount('historical_sale_imports', 0);
});

it('supports legacy warehouses and global series without a fiscal issuer', function (): void {
    $this->store->update(['fiscal_issuer_id' => null]);
    $this->historicalSeries->update(['fiscal_issuer_id' => null]);

    $this->actingAs($this->user)
        ->get('/historical-sales/create')
        ->assertOk()
        ->assertInertia(fn (Assert $page): Assert => $page
            ->component('historical-sales/create')
            ->where('warehouses.0.id', $this->warehouse->id)
            ->where('warehouses.0.fiscal_issuer_id', null)
            ->where('series', fn ($series): bool => $series->contains(
                fn (array $item): bool => $item['id'] === $this->historicalSeries->id
                    && $item['fiscal_issuer_id'] === null,
            )));

    $this->actingAs($this->user)->post('/historical-sales', [
        'warehouse_id' => $this->warehouse->id,
        'document_series_id' => $this->historicalSeries->id,
        'file' => historicalSalesSpreadsheet([
            ['10/08/2026', '11:25', '25.00'],
        ]),
    ])->assertRedirect();

    expect(HistoricalSaleImport::query()->firstOrFail()->status)->toBe('ready');
});

it('defaults new web imports to the main warehouse', function (): void {
    $mainWarehouse = Warehouse::factory()->for($this->store)->main()->create();

    $this->actingAs($this->user)
        ->get('/historical-sales/create')
        ->assertOk()
        ->assertInertia(fn (Assert $page): Assert => $page
            ->component('historical-sales/create')
            ->where('default_warehouse_id', $mainWarehouse->id));
});

/**
 * @param  list<array{string, string, string}>  $rows
 */
function historicalSalesSpreadsheet(array $rows): UploadedFile
{
    return yapeSpreadsheet(array_map(
        static fn (array $row): array => [
            'TE PAGÓ',
            'Cliente Uno*',
            'Mi negocio*',
            $row[2],
            '',
            "{$row[0]} {$row[1]}:00",
        ],
        $rows,
    ));
}

/**
 * @param  list<array{string, string, string, string, string, string}>  $rows
 */
function yapeSpreadsheet(array $rows): UploadedFile
{
    $spreadsheet = new Spreadsheet;
    $spreadsheet->getActiveSheet()->fromArray([
        ['Reporte de movimientos'],
        ['Cuenta de prueba'],
        [],
        [],
        ['Tipo de Transacción', 'Origen', 'Destino', 'Monto', 'Mensaje', 'Fecha de operación'],
        ...$rows,
    ]);
    $path = tempnam(sys_get_temp_dir(), 'historical-sales-');

    if ($path === false) {
        throw new RuntimeException('No se pudo crear el Excel temporal.');
    }

    (new Xlsx($spreadsheet))->save($path);
    $spreadsheet->disconnectWorksheets();

    return new UploadedFile(
        $path,
        'movimientos-yape.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        null,
        true,
    );
}
