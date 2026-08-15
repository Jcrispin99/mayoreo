<?php

declare(strict_types=1);

use App\Models\CashRegister;
use App\Models\CashRegisterSession;
use App\Models\DocumentSeries;
use App\Models\PriceTier;
use App\Models\Product;
use App\Models\ProductTemplate;
use App\Models\Stock;
use App\Models\Store;
use App\Models\UnitOfMeasure;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->user = User::factory()->create();
    grantApiPermissions($this->user, 'cash-sessions.view', 'cash-sessions.manage');
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

it('returns every active catalog product without requiring warehouse stock', function (): void {
    $sameStoreProduct = Product::factory()->create([
        'sku' => 'POS-SAME-STORE',
        'barcode' => '7500000000001',
        'name' => 'Producto de la tienda',
        'image_path' => 'products/same-store.jpg',
        'is_favorite' => true,
    ]);
    $otherStore = Store::factory()->create();
    $otherStoreWarehouse = Warehouse::factory()->for($otherStore)->create();
    $otherStoreProduct = Product::factory()->create([
        'sku' => 'POS-OTHER-STORE',
        'name' => 'Producto de otra tienda',
    ]);
    $neverStockedProduct = Product::factory()->create([
        'sku' => 'POS-NEVER-STOCKED',
        'name' => 'Producto sin movimientos',
    ]);

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

    $response = $this->withHeaders($this->headers)
        ->getJson("/api/v1/cash-register-sessions/{$this->session->id}/catalog")
        ->assertOk()
        ->assertJsonCount(3, 'data.items')
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

    expect($response->json('data.items.*.id'))
        ->toContain($otherStoreProduct->id, $neverStockedProduct->id);

    $neverStockedItem = collect($response->json('data.items'))
        ->firstWhere('id', $neverStockedProduct->id);

    expect($neverStockedItem['stock_available'] ?? null)->toBe('0.000000');
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

it('reports template stock in the catalog and packaged availability in its variant selector', function (): void {
    $grams = UnitOfMeasure::factory()->grams()->create();
    $units = UnitOfMeasure::factory()->units()->create();
    $template = ProductTemplate::query()->create([
        'name' => 'Azúcar',
        'is_active' => true,
        'is_pos_visible' => true,
    ]);
    $principal = Product::factory()->for($grams, 'baseUnit')->create([
        'product_template_id' => $template->id,
        'name' => 'Azúcar - Granel',
        'variant_name' => 'Granel',
        'sale_mode' => 'measured',
        'is_principal' => true,
    ]);
    $bag250 = Product::factory()->for($units, 'baseUnit')->create([
        'product_template_id' => $template->id,
        'name' => 'Azúcar - Bolsa 250 g',
        'variant_name' => 'Bolsa 250 g',
        'sale_mode' => 'unit',
        'content_quantity' => '250',
        'content_unit_id' => $grams->id,
        'is_principal' => false,
    ]);
    Stock::factory()->for($principal)->for($this->warehouse)->create([
        'quantity' => '10000.000000',
    ]);
    PriceTier::factory()->for($bag250)->create([
        'min_quantity' => 1,
        'unit_price' => '2.5000',
        'is_active' => true,
    ]);

    $this->withHeaders($this->headers)
        ->getJson("/api/v1/cash-register-sessions/{$this->session->id}/catalog?search=Az%C3%BAcar")
        ->assertOk()
        ->assertJsonCount(1, 'data.items')
        ->assertJsonPath('data.items.0.id', $principal->id)
        ->assertJsonPath('data.items.0.stock_available', '10000.000000');

    $variants = $this->withHeaders($this->headers)
        ->getJson("/api/v1/cash-register-sessions/{$this->session->id}/catalog/templates/{$template->id}/variants")
        ->assertOk();

    $bagItem = collect($variants->json('data'))->firstWhere('id', $bag250->id);

    expect($bagItem['stock_available'] ?? null)->toBe('40.000000');
});

it('loads 30 products initially and continues with an opaque cursor', function (): void {
    foreach (range(1, 31) as $index) {
        Product::factory()->create([
            'name' => sprintf('Producto paginado %02d', $index),
            'sku' => "PAGE-{$index}",
            'is_favorite' => false,
        ]);
    }

    $firstPage = $this->withHeaders($this->headers)
        ->getJson("/api/v1/cash-register-sessions/{$this->session->id}/catalog")
        ->assertOk()
        ->assertJsonCount(30, 'data.items')
        ->assertJsonPath('data.has_more', true);

    $cursor = $firstPage->json('data.next_cursor');

    expect($cursor)->toBeString()->not->toBe('');

    $secondPage = $this->withHeaders($this->headers)
        ->getJson("/api/v1/cash-register-sessions/{$this->session->id}/catalog?".http_build_query([
            'cursor' => $cursor,
        ]))
        ->assertOk()
        ->assertJsonCount(1, 'data.items')
        ->assertJsonPath('data.has_more', false)
        ->assertJsonPath('data.next_cursor', null);

    expect(array_merge(
        $firstPage->json('data.items.*.id'),
        $secondPage->json('data.items.*.id')
    ))->toHaveCount(31)->each->toBeInt();
});

it('finds products by name even when they have never had stock', function (): void {
    $template = ProductTemplate::query()->create([
        'name' => 'Aji amarillo C/P',
        'is_active' => true,
        'is_pos_visible' => true,
    ]);
    $aji = Product::factory()->create([
        'product_template_id' => $template->id,
        'name' => 'Aji amarillo C/P - Granel',
        'variant_name' => 'Granel',
        'sale_mode' => 'measured',
        'is_principal' => true,
    ]);
    PriceTier::factory()->for($aji)->create(['is_active' => true]);

    $this->withHeaders($this->headers)
        ->getJson("/api/v1/cash-register-sessions/{$this->session->id}/catalog?".http_build_query([
            'search' => 'aji amarillo',
        ]))
        ->assertOk()
        ->assertJsonCount(1, 'data.items')
        ->assertJsonPath('data.items.0.id', $aji->id)
        ->assertJsonPath('data.items.0.stock_available', '0.000000');
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
