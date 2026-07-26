<?php

declare(strict_types=1);

use App\Models\DocumentSeries;
use App\Models\FiscalIssuer;
use App\Models\PriceTier;
use App\Models\Product;
use App\Models\Store;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\StockLedgerService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $user = User::factory()->create();
    grantApiPermissions(
        $user,
        'sales.view',
        'sales.manage',
        'pos-config.view',
        'pos-config.manage',
    );
    $this->headers = [
        'Authorization' => 'Bearer '.$user->createToken('fiscal-snapshot-test')->plainTextToken,
    ];
    $this->issuer = FiscalIssuer::factory()->create([
        'legal_name' => 'Emisor Original SAC',
        'trade_name' => 'Emisor Original',
    ]);
    $this->store = Store::factory()
        ->for($this->issuer, 'fiscalIssuer')
        ->create([
            'sunat_establishment_code' => '0001',
            'sunat_address' => 'Av. Fiscal Original 123',
            'sunat_ubigeo' => '150101',
            'sunat_urbanization' => 'Zona Industrial',
            'sunat_department' => 'Lima',
            'sunat_province' => 'Lima',
            'sunat_district' => 'Lima',
        ]);
    $this->warehouse = Warehouse::factory()
        ->for($this->store)
        ->create(['code' => 'FISCAL-SNAPSHOT-WH']);
    $this->ticketSeries = DocumentSeries::factory()
        ->for($this->issuer, 'fiscalIssuer')
        ->create([
            'document_type' => 'sales_ticket',
            'series_code' => 'NV01',
        ]);
    DocumentSeries::factory()
        ->for($this->issuer, 'fiscalIssuer')
        ->create([
            'document_type' => 'receipt',
            'series_code' => 'B001',
        ]);
    $this->product = Product::factory()->create();
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

it('stores an immutable issuer and establishment snapshot on every fiscal document', function (): void {
    $sale = $this->withHeaders($this->headers)
        ->postJson('/api/v1/sales', [
            'warehouse_id' => $this->warehouse->id,
            'document_series_id' => $this->ticketSeries->id,
            'items' => [
                ['product_id' => $this->product->id, 'quantity' => '1'],
            ],
        ])
        ->assertCreated()
        ->assertJsonPath('data.primary_document.fiscal_issuer_id', $this->issuer->id)
        ->assertJsonPath('data.primary_document.issuer.legal_name', 'Emisor Original SAC')
        ->assertJsonPath('data.primary_document.establishment.code', '0001')
        ->assertJsonPath('data.primary_document.establishment.address', 'Av. Fiscal Original 123')
        ->assertJsonPath('data.primary_document.establishment.ubigeo', '150101')
        ->json('data');

    $this->issuer->update([
        'legal_name' => 'Emisor Renombrado SAC',
        'trade_name' => 'Emisor Renombrado',
    ]);
    $this->store->update([
        'sunat_address' => 'Av. Fiscal Nueva 999',
        'sunat_district' => 'Miraflores',
    ]);

    $this->withHeaders($this->headers)
        ->postJson("/api/v1/sales/{$sale['id']}/fiscal-documents", [
            'document_type' => 'receipt',
        ])
        ->assertCreated()
        ->assertJsonPath('data.issuer.legal_name', 'Emisor Original SAC')
        ->assertJsonPath('data.establishment.address', 'Av. Fiscal Original 123')
        ->assertJsonPath('data.establishment.district', 'Lima');

    $this->withHeaders($this->headers)
        ->getJson("/api/v1/sales/{$sale['id']}/fiscal-documents")
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.issuer.legal_name', 'Emisor Original SAC')
        ->assertJsonPath('data.0.establishment.address', 'Av. Fiscal Original 123')
        ->assertJsonPath('data.1.issuer.legal_name', 'Emisor Original SAC')
        ->assertJsonPath('data.1.establishment.address', 'Av. Fiscal Original 123');
});

it('rejects a sale when its series belongs to another issuer', function (): void {
    $otherIssuer = FiscalIssuer::factory()->create();
    $otherSeries = DocumentSeries::factory()
        ->for($otherIssuer, 'fiscalIssuer')
        ->create([
            'document_type' => 'sales_ticket',
            'series_code' => 'NV01',
        ]);

    $this->withHeaders($this->headers)
        ->postJson('/api/v1/sales', [
            'warehouse_id' => $this->warehouse->id,
            'document_series_id' => $otherSeries->id,
            'items' => [
                ['product_id' => $this->product->id, 'quantity' => '1'],
            ],
        ])
        ->assertUnprocessable();

    $this->assertDatabaseCount('sales', 0);
    $this->assertDatabaseCount('fiscal_documents', 0);
    expect($otherSeries->fresh()?->current_number)->toBe(0);
});

it('rejects assigning another issuer series to a store cash register', function (): void {
    $otherIssuer = FiscalIssuer::factory()->create();
    $otherSeries = DocumentSeries::factory()
        ->for($otherIssuer, 'fiscalIssuer')
        ->create([
            'document_type' => 'sales_ticket',
            'series_code' => 'NV02',
        ]);

    $this->withHeaders($this->headers)
        ->postJson('/api/v1/cash-registers', [
            'store_id' => $this->store->id,
            'warehouse_id' => $this->warehouse->id,
            'default_sales_series_id' => $otherSeries->id,
            'sales_series_ids' => [$otherSeries->id],
            'code' => 'CAJA-CRUZADA',
            'name' => 'Caja cruzada',
            'is_active' => true,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('sales_series_ids');

    $this->assertDatabaseMissing('cash_registers', [
        'store_id' => $this->store->id,
        'code' => 'CAJA-CRUZADA',
    ]);
});
