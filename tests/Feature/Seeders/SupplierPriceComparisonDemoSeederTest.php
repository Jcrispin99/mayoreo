<?php

declare(strict_types=1);

use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\SupplierProductPrice;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\SupplierPriceComparisonDemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

it('seeds repeatable standalone supplier prices without purchases or stock movements', function (): void {
    Carbon::setTestNow('2026-08-11 10:00:00');
    $this->seed(DatabaseSeeder::class);
    $movementsBefore = InventoryMovement::query()->count();
    $purchasesBefore = PurchaseOrder::query()->count();

    $this->seed(SupplierPriceComparisonDemoSeeder::class);

    $andina = Supplier::query()->where('document_number', '20900000001')->firstOrFail();
    $flour = Product::query()->where('sku', 'A001')->firstOrFail();
    $andinaFlour = SupplierProductPrice::query()
        ->whereBelongsTo($andina)
        ->whereBelongsTo($flour)
        ->firstOrFail();

    expect(Supplier::query()->whereIn('document_number', [
        '20900000001',
        '20900000002',
        '20900000003',
    ])->count())->toBe(3)
        ->and(SupplierProductPrice::query()->count())->toBe(14)
        ->and($andinaFlour->unit_cost)->toBe('4.5000')
        ->and($andinaFlour->product_purchase_unit_id)->toBeNull()
        ->and($andinaFlour->quoted_at->toDateString())->toBe('2026-08-11')
        ->and(PurchaseOrder::query()->count())->toBe($purchasesBefore)
        ->and(InventoryMovement::query()->count())->toBe($movementsBefore);

    $this->seed(SupplierPriceComparisonDemoSeeder::class);

    expect(SupplierProductPrice::query()->count())->toBe(14)
        ->and(PurchaseOrder::query()->count())->toBe($purchasesBefore)
        ->and(InventoryMovement::query()->count())->toBe($movementsBefore);
});
