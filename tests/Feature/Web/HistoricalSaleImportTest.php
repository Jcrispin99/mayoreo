<?php

declare(strict_types=1);

use App\Models\DocumentSeries;
use App\Models\FiscalIssuer;
use App\Models\HistoricalSaleImport;
use App\Models\PriceTier;
use App\Models\Product;
use App\Models\Store;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\StockLedgerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Storage::fake('local');

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
        'document_type' => 'sales_ticket',
        'series_code' => 'H001',
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

it('confirms rows chronologically with an isolated series and exact totals', function (): void {
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
    $sales = $import->rows()->with('sale.fiscalDocuments')->orderBy('sold_at')->get();

    expect($import->status)->toBe('completed')
        ->and($import->imported_rows)->toBe(2)
        ->and($import->imported_total)->toBe('55.00')
        ->and($this->historicalSeries->fresh()->current_number)->toBe(2)
        ->and($this->operationalSeries->fresh()->current_number)->toBe(40)
        ->and($sales[0]->sale?->source)->toBe('historical_import')
        ->and($sales[0]->sale?->sold_at->format('Y-m-d H:i'))->toBe('2026-08-10 11:25')
        ->and($sales[0]->sale?->payable_total)->toBe('25.00')
        ->and($sales[0]->sale?->fiscalDocuments->first()?->number)->toBe(1)
        ->and($sales[1]->sale?->fiscalDocuments->first()?->number)->toBe(2);
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

/**
 * @param  list<array{string, string, string}>  $rows
 */
function historicalSalesSpreadsheet(array $rows): UploadedFile
{
    $spreadsheet = new Spreadsheet;
    $spreadsheet->getActiveSheet()->fromArray([
        ['fecha', 'hora', 'total'],
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
        'ventas-historicas.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        null,
        true,
    );
}
