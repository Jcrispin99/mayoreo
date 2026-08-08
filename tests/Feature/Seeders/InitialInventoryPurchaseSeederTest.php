<?php

declare(strict_types=1);

use App\Models\DocumentSeries;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\InitialInventoryPurchaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('seeds the initial inventory purchase as an idempotent draft without changing stock', function (): void {
    $this->seed(DatabaseSeeder::class);

    $order = PurchaseOrder::query()
        ->with('items')
        ->where('series_code', 'OC01')
        ->where('number', 5)
        ->firstOrFail();
    $lentejon = Product::query()->where('sku', 'A055')->firstOrFail();

    expect($order->status)->toBe('draft')
        ->and($order->supplier?->name)->toBe('Inventario inicial')
        ->and($order->warehouse?->code)->toBe('MAIN')
        ->and($order->total)->toBe('38960.6300')
        ->and($order->items)->toHaveCount(30)
        ->and(PurchaseOrder::query()->count())->toBe(1)
        ->and(InventoryMovement::query()->count())->toBe(0)
        ->and($lentejon->stocks()->whereHas('warehouse', fn ($query) => $query->where('code', 'MAIN'))->exists())
        ->toBeFalse();

    $this->assertDatabaseHas('productables', [
        'productable_type' => PurchaseOrder::class,
        'productable_id' => $order->id,
        'product_id' => $lentejon->id,
        'product_purchase_unit_id' => null,
        'quantity_purchased' => 850,
        'quantity' => 0,
        'unit_cost' => 3.2222,
    ]);
    expect(DocumentSeries::query()
        ->where('document_type', 'purchase')
        ->where('series_code', 'OC01')
        ->value('current_number'))->toBe(5);

    $this->seed(InitialInventoryPurchaseSeeder::class);

    expect(PurchaseOrder::query()
        ->where('series_code', 'OC01')
        ->where('number', 5)
        ->count())->toBe(1)
        ->and(Supplier::query()->where('name', 'Inventario inicial')->count())->toBe(1)
        ->and($order->fresh()?->items()->count())->toBe(30);
});
