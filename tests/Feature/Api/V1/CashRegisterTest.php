<?php

declare(strict_types=1);

use App\Models\CashRegister;
use App\Models\DocumentSeries;
use App\Models\Store;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $user = User::factory()->create();
    grantApiPermissions($user, 'pos-config.view', 'pos-config.manage');
    $this->headers = ['Authorization' => 'Bearer '.$user->createToken('cash-register-test')->plainTextToken];
    $this->store = Store::factory()->create();
    $this->warehouse = Warehouse::factory()->for($this->store)->pos()->create();
    $this->salesSeries = DocumentSeries::factory()->create([
        'document_type' => 'sales_ticket',
        'series_code' => 'NV01',
        'current_number' => 10,
        'is_active' => true,
    ]);
});

function cashRegisterPayload(Store $store, Warehouse $warehouse, DocumentSeries|array $series, array $overrides = []): array
{
    $seriesRecords = is_array($series) ? $series : [$series];

    return [
        'store_id' => $store->id,
        'warehouse_id' => $warehouse->id,
        'default_sales_series_id' => $seriesRecords[0]->id,
        'sales_series_ids' => array_map(fn (DocumentSeries $item): int => $item->id, $seriesRecords),
        'code' => 'CAJA-01',
        'name' => 'Caja principal',
        'is_active' => true,
        ...$overrides,
    ];
}

it('creates a cash register selecting multiple series and one default', function (): void {
    $invoiceSeries = DocumentSeries::factory()->create([
        'document_type' => 'invoice',
        'series_code' => 'F001',
    ]);
    $response = $this->withHeaders($this->headers)
        ->postJson('/api/v1/cash-registers', cashRegisterPayload($this->store, $this->warehouse, [$this->salesSeries, $invoiceSeries]));

    $response->assertCreated()
        ->assertJsonPath('data.code', 'CAJA-01')
        ->assertJsonPath('data.warehouse_id', $this->warehouse->id)
        ->assertJsonPath('data.default_sales_series_id', $this->salesSeries->id)
        ->assertJsonPath('data.default_sales_series.series_code', 'NV01')
        ->assertJsonCount(2, 'data.sales_series');

    $this->assertDatabaseHas('cash_registers', [
        'store_id' => $this->store->id,
        'warehouse_id' => $this->warehouse->id,
        'default_sales_series_id' => $this->salesSeries->id,
    ]);
    $this->assertDatabaseCount('cash_register_document_series', 2);
});

it('lists and filters cash registers by store', function (): void {
    $cashRegister = CashRegister::query()->create([
        ...cashRegisterPayload($this->store, $this->warehouse, $this->salesSeries),
        'sales_series_ids' => null,
    ]);
    $cashRegister->salesSeries()->attach($this->salesSeries);

    $this->withHeaders($this->headers)
        ->getJson("/api/v1/cash-registers?store_id={$this->store->id}")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.warehouse.id', $this->warehouse->id)
        ->assertJsonPath('data.0.default_sales_series.id', $this->salesSeries->id)
        ->assertJsonCount(1, 'data.0.sales_series');
});

it('rejects an active warehouse from another store', function (): void {
    $otherWarehouse = Warehouse::factory()->for(Store::factory())->pos()->create(['code' => 'POS-OTHER']);

    $this->withHeaders($this->headers)
        ->postJson('/api/v1/cash-registers', cashRegisterPayload($this->store, $otherWarehouse, $this->salesSeries))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('warehouse_id');
});

it('rejects a purchase series or an inactive sales series', function (): void {
    $purchaseSeries = DocumentSeries::query()->where('document_type', 'purchase')->firstOrFail();

    $this->withHeaders($this->headers)
        ->postJson('/api/v1/cash-registers', cashRegisterPayload($this->store, $this->warehouse, $purchaseSeries))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['default_sales_series_id', 'sales_series_ids.0']);

    $this->salesSeries->update(['is_active' => false]);

    $this->withHeaders($this->headers)
        ->postJson('/api/v1/cash-registers', cashRegisterPayload($this->store, $this->warehouse, $this->salesSeries))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['default_sales_series_id', 'sales_series_ids.0']);
});

it('does not allow a selected series to be assigned to two cash registers', function (): void {
    $this->withHeaders($this->headers)
        ->postJson('/api/v1/cash-registers', cashRegisterPayload($this->store, $this->warehouse, $this->salesSeries))
        ->assertCreated();

    $this->withHeaders($this->headers)
        ->postJson('/api/v1/cash-registers', cashRegisterPayload($this->store, $this->warehouse, $this->salesSeries, [
            'code' => 'CAJA-02',
            'name' => 'Caja secundaria',
        ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('sales_series_ids');
});

it('updates the selected series and its default', function (): void {
    $created = $this->withHeaders($this->headers)
        ->postJson('/api/v1/cash-registers', cashRegisterPayload($this->store, $this->warehouse, $this->salesSeries))
        ->assertCreated()->json('data');
    $nextSeries = DocumentSeries::factory()->create([
        'document_type' => 'receipt',
        'series_code' => 'B002',
        'current_number' => 0,
    ]);

    $this->withHeaders($this->headers)
        ->putJson("/api/v1/cash-registers/{$created['id']}", cashRegisterPayload(
            $this->store,
            $this->warehouse,
            [$this->salesSeries, $nextSeries],
            [
                'name' => 'Caja mostrador',
                'default_sales_series_id' => $nextSeries->id,
            ],
        ))
        ->assertOk()
        ->assertJsonPath('data.name', 'Caja mostrador')
        ->assertJsonPath('data.default_sales_series.id', $nextSeries->id)
        ->assertJsonCount(2, 'data.sales_series');
});

it('requires the default series to be selected', function (): void {
    $otherSeries = DocumentSeries::factory()->create(['series_code' => 'NV02']);

    $this->withHeaders($this->headers)
        ->postJson('/api/v1/cash-registers', cashRegisterPayload(
            $this->store,
            $this->warehouse,
            $this->salesSeries,
            ['default_sales_series_id' => $otherSeries->id],
        ))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('default_sales_series_id');
});

it('requires authentication', function (): void {
    $this->getJson('/api/v1/cash-registers')->assertUnauthorized();
});
