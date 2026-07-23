<?php

declare(strict_types=1);

use App\Models\CashRegister;
use App\Models\CashRegisterSession;
use App\Models\DocumentSeries;
use App\Models\PriceTier;
use App\Models\Product;
use App\Models\Stock;
use App\Models\Store;
use App\Models\UnitOfMeasure;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->user = User::factory()->create();
    $this->headers = ['Authorization' => 'Bearer '.$this->user->createToken('pos-catalog-test')->plainTextToken];
    $this->store = Store::factory()->create();
    $this->warehouse = Warehouse::factory()->for($this->store)->pos()->create();
    $this->otherWarehouse = Warehouse::factory()->for($this->store)->create();
    $series = DocumentSeries::factory()->create([
        'document_type' => 'sales_ticket',
        'series_code' => 'PV99',
    ]);
    $this->cashRegister = CashRegister::query()->create([
        'store_id' => $this->store->id,
        'warehouse_id' => $this->warehouse->id,
        'default_sales_series_id' => $series->id,
        'code' => 'POS-CAT',
        'name' => 'Caja catálogo',
        'is_active' => true,
    ]);
    $this->session = CashRegisterSession::query()->create([
        'cash_register_id' => $this->cashRegister->id,
        'opened_by' => $this->user->id,
        'status' => 'open',
        'opening_amount' => '100.00',
        'opened_at' => now(),
    ]);
});

it('returns products associated with any warehouse from the session store', function (): void {
    $sameStoreProduct = Product::factory()->create([
        'sku' => 'POS-SAME-STORE',
        'barcode' => '7500000000001',
        'name' => 'Producto de la tienda',
        'image_path' => 'products/same-store.jpg',
        'is_favorite' => true,
    ]);
    $otherStore = Store::factory()->create();
    $otherStoreWarehouse = Warehouse::factory()->for($otherStore)->create();
    $otherStoreProduct = Product::factory()->create(['sku' => 'POS-OTHER-STORE']);

    Stock::factory()->for($sameStoreProduct)->for($this->otherWarehouse)->create(['quantity' => '30.000000']);
    Stock::factory()->for($otherStoreProduct)->for($otherStoreWarehouse)->create(['quantity' => '50.000000']);
    PriceTier::factory()->for($sameStoreProduct)->create([
        'min_quantity' => 0,
        'unit_price' => '4.5000',
        'is_active' => true,
    ]);
    PriceTier::factory()->for($sameStoreProduct)->create([
        'min_quantity' => 10,
        'unit_price' => '4.0000',
        'is_active' => false,
    ]);

    $this->withHeaders($this->headers)
        ->getJson("/api/v1/cash-register-sessions/{$this->session->id}/catalog?warehouse_id={$otherStoreWarehouse->id}")
        ->assertOk()
        ->assertJsonCount(1, 'data.items')
        ->assertJsonPath('data.items.0.id', $sameStoreProduct->id)
        ->assertJsonPath('data.items.0.sku', 'POS-SAME-STORE')
        ->assertJsonPath('data.items.0.barcode', '7500000000001')
        ->assertJsonPath('data.items.0.stock_available', '0.000000')
        ->assertJsonPath('data.items.0.is_favorite', true)
        ->assertJsonPath('data.items.0.base_unit.id', $sameStoreProduct->base_unit_id)
        ->assertJsonPath('data.items.0.price_tiers.0.unit_price', '4.5000')
        ->assertJsonCount(1, 'data.items.0.price_tiers')
        ->assertJsonPath('data.has_more', false)
        ->assertJsonPath('data.next_cursor', null);
});

it('excludes inactive products even when they have stock', function (): void {
    $inactive = Product::factory()->create(['is_active' => false]);
    Stock::factory()->for($inactive)->for($this->warehouse)->create(['quantity' => '8.000000']);

    $this->withHeaders($this->headers)
        ->getJson("/api/v1/cash-register-sessions/{$this->session->id}/catalog")
        ->assertOk()
        ->assertJsonCount(0, 'data.items');
});

it('reports zero or negative stock independently for the session warehouse', function (): void {
    $product = Product::factory()->create();
    Stock::factory()->for($product)->for($this->warehouse)->create(['quantity' => '-7.250000']);
    Stock::factory()->for($product)->for($this->otherWarehouse)->create(['quantity' => '99.000000']);

    $this->withHeaders($this->headers)
        ->getJson("/api/v1/cash-register-sessions/{$this->session->id}/catalog")
        ->assertOk()
        ->assertJsonPath('data.items.0.stock_available', '-7.250000');
});

it('loads the POS catalog incrementally with an opaque cursor', function (): void {
    foreach (['Alfa', 'Beta', 'Gamma'] as $index => $name) {
        $product = Product::factory()->create([
            'name' => $name,
            'sku' => "PAGE-{$index}",
            'is_favorite' => false,
        ]);
        Stock::factory()->for($product)->for($this->otherWarehouse)->create();
    }

    $firstPage = $this->withHeaders($this->headers)
        ->getJson("/api/v1/cash-register-sessions/{$this->session->id}/catalog?per_page=2")
        ->assertOk()
        ->assertJsonCount(2, 'data.items')
        ->assertJsonPath('data.has_more', true);

    $cursor = $firstPage->json('data.next_cursor');

    expect($cursor)->toBeString()->not->toBe('');

    $secondPage = $this->withHeaders($this->headers)
        ->getJson("/api/v1/cash-register-sessions/{$this->session->id}/catalog?".http_build_query([
            'per_page' => 2,
            'cursor' => $cursor,
        ]))
        ->assertOk()
        ->assertJsonCount(1, 'data.items')
        ->assertJsonPath('data.has_more', false)
        ->assertJsonPath('data.next_cursor', null);

    expect(array_merge(
        $firstPage->json('data.items.*.id'),
        $secondPage->json('data.items.*.id')
    ))->toHaveCount(3)->each->toBeInt();
});

it('searches and filters the catalog on the server', function (): void {
    $volumeUnit = UnitOfMeasure::factory()->milliliters()->create();
    $matching = Product::factory()->for($volumeUnit, 'baseUnit')->create([
        'name' => 'Bebida especial',
        'sku' => 'DRINK-001',
        'barcode' => '7751234567890',
        'is_favorite' => true,
    ]);
    $other = Product::factory()->create([
        'name' => 'Producto diferente',
        'sku' => 'OTHER-001',
        'is_favorite' => false,
    ]);

    Stock::factory()->for($matching)->for($this->otherWarehouse)->create();
    Stock::factory()->for($matching)->for($this->warehouse)->create(['quantity' => '-2.000000']);
    Stock::factory()->for($other)->for($this->warehouse)->create(['quantity' => '10.000000']);
    PriceTier::factory()->for($matching)->create(['is_active' => true]);

    $query = http_build_query([
        'search' => '7751234567890',
        'filters' => ['favorite', 'type:volume', 'stock:negative', 'price:configured'],
    ]);

    $this->withHeaders($this->headers)
        ->getJson("/api/v1/cash-register-sessions/{$this->session->id}/catalog?{$query}")
        ->assertOk()
        ->assertJsonCount(1, 'data.items')
        ->assertJsonPath('data.items.0.id', $matching->id);
});

it('rejects a catalog request for a closed session', function (): void {
    $this->session->update([
        'status' => 'closed',
        'expected_amount' => '100.00',
        'counted_amount' => '100.00',
        'difference_amount' => '0.00',
        'closed_at' => now(),
    ]);

    $this->withHeaders($this->headers)
        ->getJson("/api/v1/cash-register-sessions/{$this->session->id}/catalog")
        ->assertUnprocessable();
});

it('requires authentication to read the POS catalog', function (): void {
    $this->getJson("/api/v1/cash-register-sessions/{$this->session->id}/catalog")
        ->assertUnauthorized();
});
