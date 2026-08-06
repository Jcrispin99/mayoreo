<?php

declare(strict_types=1);

use App\Models\PriceTier;
use App\Models\Product;
use App\Models\ProductPurchaseUnit;
use App\Models\ProductTemplate;
use Database\Seeders\MayoreoProductCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('seeds the reviewed spreadsheet catalog with products prices and purchase units', function (): void {
    $this->seed(MayoreoProductCatalogSeeder::class);

    expect(ProductTemplate::query()->count())->toBe(441)
        ->and(Product::query()->count())->toBe(441)
        ->and(PriceTier::query()->where('is_active', true)->count())->toBe(594);

    $flour = Product::query()
        ->with(['template', 'baseUnit', 'priceTiers', 'purchaseUnits'])
        ->where('sku', 'A001')
        ->firstOrFail();

    expect($flour->template?->name)->toBe('Harina 7 semillas')
        ->and($flour->baseUnit?->code)->toBe('kg')
        ->and($flour->sale_mode)->toBe('measured')
        ->and($flour->is_principal)->toBeTrue()
        ->and($flour->priceTiers)->toHaveCount(3)
        ->and($flour->purchaseUnits)->toHaveCount(2);

    $this->assertDatabaseHas('price_tiers', [
        'product_id' => $flour->id,
        'label' => 'Menudeo',
        'min_quantity' => 0.001,
        'max_quantity' => 0.999999,
        'unit_price' => 6,
        'is_active' => true,
    ]);
    $this->assertDatabaseHas('price_tiers', [
        'product_id' => $flour->id,
        'label' => 'Por kilo',
        'min_quantity' => 1,
        'max_quantity' => 49.999999,
        'unit_price' => 5.005,
        'is_active' => true,
    ]);
    $this->assertDatabaseHas('price_tiers', [
        'product_id' => $flour->id,
        'label' => 'Cliente / saco 50 kg (total S/ 227.50)',
        'min_quantity' => 50,
        'unit_price' => 4.55,
        'is_active' => true,
    ]);
    $this->assertDatabaseHas('product_purchase_units', [
        'product_id' => $flour->id,
        'name' => 'Saco 50 kg',
        'conversion_factor' => 50,
        'is_default_purchase' => true,
    ]);
});

it('keeps incomplete products outside the POS and preserves review notes', function (): void {
    $this->seed(MayoreoProductCatalogSeeder::class);

    $outOfStock = Product::query()->with('template')->where('sku', 'A031')->firstOrFail();
    $textPrice = Product::query()->with('template')->where('sku', 'A018')->firstOrFail();
    $oliveOil = Product::query()->with(['baseUnit', 'contentUnit'])->where('sku', 'A378')->firstOrFail();

    expect($outOfStock->priceTiers()->where('is_active', true)->count())->toBe(0)
        ->and($outOfStock->template?->is_pos_visible)->toBeFalse()
        ->and($textPrice->template?->description)->toContain('30 - 25')
        ->and($oliveOil->sale_mode)->toBe('unit')
        ->and($oliveOil->baseUnit?->code)->toBe('NIU')
        ->and($oliveOil->content_quantity)->toBe('0.500000')
        ->and($oliveOil->contentUnit?->code)->toBe('L');
});

it('can run repeatedly without duplicating catalog records', function (): void {
    $this->seed(MayoreoProductCatalogSeeder::class);

    $templateCount = ProductTemplate::query()->count();
    $productCount = Product::query()->count();
    $tierCount = PriceTier::query()->count();
    $purchaseUnitCount = ProductPurchaseUnit::query()->count();

    $this->seed(MayoreoProductCatalogSeeder::class);

    expect(ProductTemplate::query()->count())->toBe($templateCount)
        ->and(Product::query()->count())->toBe($productCount)
        ->and(PriceTier::query()->count())->toBe($tierCount)
        ->and(ProductPurchaseUnit::query()->count())->toBe($purchaseUnitCount);
});
