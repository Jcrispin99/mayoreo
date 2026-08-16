<?php

declare(strict_types=1);

use App\Models\Supplier;
use App\Models\SupplierProductPrice;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\SupplierPriceComparisonDemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(DatabaseSeeder::class);
    $this->seed(SupplierPriceComparisonDemoSeeder::class);
    $user = User::factory()->create();
    grantApiPermissions($user, 'purchase-orders.view', 'purchase-orders.manage');
    $this->headers = ['Authorization' => 'Bearer '.$user->createToken('test')->plainTextToken];
});

it('lists supplier prices by kilogram or base unit', function (): void {
    $andina = Supplier::query()->where('document_number', '20900000001')->firstOrFail();

    $response = $this->withHeaders($this->headers)->getJson(
        "/api/v1/supplier-product-prices?filter=priced&supplier_ids={$andina->id}&per_page=5",
    );

    $response->assertOk()
        ->assertJsonPath('data.pagination.per_page', 5)
        ->assertJsonPath('data.pagination.total', 5)
        ->assertJsonCount(5, 'data.items');

    $flour = collect($response->json('data.items'))->firstWhere('sku', 'A001');
    $andinaFlourPrice = collect($flour['prices'] ?? [])->firstWhere('supplier_id', $andina->id);
    expect($flour)->not->toBeNull()
        ->and($andinaFlourPrice['comparison_price'])->toBe(4.5)
        ->and($andinaFlourPrice['comparison_unit'])->toBe('kg');
});

it('searches products and exposes suppliers without the inventory placeholder', function (): void {
    $this->withHeaders($this->headers)
        ->getJson('/api/v1/supplier-product-prices?search=Bicarbonato&per_page=5')
        ->assertOk()
        ->assertJsonPath('data.pagination.total', 1)
        ->assertJsonPath('data.items.0.sku', 'A049');

    $response = $this->withHeaders($this->headers)
        ->getJson('/api/v1/supplier-product-prices/suppliers')
        ->assertOk();

    expect(collect($response->json('data'))->pluck('name'))->not->toContain('Inventario inicial');
});

it('creates or updates a standalone supplier price without creating a purchase', function (): void {
    $supplier = Supplier::query()->where('document_number', '20900000001')->firstOrFail();
    $product = App\Models\Product::query()->where('sku', 'A001')->firstOrFail();
    $purchasesBefore = App\Models\PurchaseOrder::query()->count();
    $pricesBefore = SupplierProductPrice::query()->count();

    $this->withHeaders($this->headers)->postJson('/api/v1/supplier-product-prices', [
        'supplier_id' => $supplier->id,
        'product_id' => $product->id,
        'unit_cost' => 4.31,
        'quoted_at' => '2026-08-11',
        'notes' => 'Precio actualizado desde el comparador.',
    ])->assertOk()
        ->assertJsonPath('data.product_purchase_unit_id', null)
        ->assertJsonPath('data.unit_cost', '4.3100')
        ->assertJsonPath('data.comparison_price', 4.31)
        ->assertJsonPath('data.comparison_unit', 'kg');

    expect(SupplierProductPrice::query()->count())->toBe($pricesBefore)
        ->and(App\Models\PurchaseOrder::query()->count())->toBe($purchasesBefore);
});

it('stores unit products directly by their base unit and rejects package prices', function (): void {
    $supplier = Supplier::query()->where('document_number', '20900000001')->firstOrFail();
    $product = App\Models\Product::query()->where('sku', 'A254')->firstOrFail();
    $purchaseUnit = $product->purchaseUnits()->where('conversion_factor', '>', 1)->firstOrFail();

    $this->withHeaders($this->headers)->postJson('/api/v1/supplier-product-prices', [
        'supplier_id' => $supplier->id,
        'product_id' => $product->id,
        'unit_cost' => 8.50,
        'quoted_at' => '2026-08-11',
    ])->assertOk()
        ->assertJsonPath('data.unit_cost', '8.5000')
        ->assertJsonPath('data.comparison_price', 8.5)
        ->assertJsonPath('data.comparison_unit', 'unidad');

    $this->withHeaders($this->headers)->postJson('/api/v1/supplier-product-prices', [
        'supplier_id' => $supplier->id,
        'product_id' => $product->id,
        'product_purchase_unit_id' => $purchaseUnit->id,
        'unit_cost' => 102,
        'quoted_at' => '2026-08-11',
    ])->assertUnprocessable()
        ->assertJsonValidationErrors('product_purchase_unit_id');
});
