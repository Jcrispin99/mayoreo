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

it('lists supplier prices with server pagination and normalized package costs', function (): void {
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
    $purchaseUnit = $product->purchaseUnits()->where('conversion_factor', '>', 1)->firstOrFail();
    $purchasesBefore = App\Models\PurchaseOrder::query()->count();
    $pricesBefore = SupplierProductPrice::query()->count();

    $this->withHeaders($this->headers)->postJson('/api/v1/supplier-product-prices', [
        'supplier_id' => $supplier->id,
        'product_id' => $product->id,
        'product_purchase_unit_id' => $purchaseUnit->id,
        'unit_cost' => 215.50,
        'quoted_at' => '2026-08-11',
        'notes' => 'Precio actualizado desde el comparador.',
    ])->assertOk()
        ->assertJsonPath('data.unit_cost', '215.5000')
        ->assertJsonPath('data.comparison_price', 4.31);

    expect(SupplierProductPrice::query()->count())->toBe($pricesBefore)
        ->and(App\Models\PurchaseOrder::query()->count())->toBe($purchasesBefore);
});
