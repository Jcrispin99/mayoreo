<?php

declare(strict_types=1);

use App\Models\PriceTier;
use App\Models\Product;
use App\Models\ProductPurchaseUnit;
use App\Models\ProductTemplate;
use App\Models\UnitOfMeasure;
use Database\Seeders\MayoreoProductCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('seeds the reviewed spreadsheet catalog with only templates and units of measure', function (): void {
    $this->seed(MayoreoProductCatalogSeeder::class);

    expect(ProductTemplate::query()->count())->toBe(441)
        ->and(Product::query()->count())->toBe(441)
        ->and(PriceTier::query()->count())->toBe(0)
        ->and(ProductPurchaseUnit::query()->count())->toBe(0)
        ->and(UnitOfMeasure::query()->orderBy('code')->pluck('code')->all())->toBe(['NIU', 'kg'])
        ->and(UnitOfMeasure::query()->orderBy('code')->pluck('name', 'code')->all())->toBe([
            'NIU' => 'Unidad',
            'kg' => 'Kilogramos',
        ]);

    $flour = Product::query()
        ->with(['template', 'baseUnit'])
        ->where('sku', 'A001')
        ->firstOrFail();

    expect($flour->template?->name)->toBe('Harina 7 semillas')
        ->and($flour->baseUnit?->code)->toBe('kg')
        ->and($flour->variant_name)->toBe('Kilogramos')
        ->and($flour->sale_mode)->toBe('measured')
        ->and($flour->is_principal)->toBeTrue();

    $liquid = Product::query()->with('baseUnit')->where('sku', 'A254')->firstOrFail();
    expect($liquid->baseUnit?->code)->toBe('NIU')
        ->and($liquid->sale_mode)->toBe('unit')
        ->and($liquid->content_quantity)->toBeNull();
});

it('keeps unpriced templates outside the POS and preserves review notes', function (): void {
    $this->seed(MayoreoProductCatalogSeeder::class);

    $flour = Product::query()->with('template')->where('sku', 'A001')->firstOrFail();
    $textPrice = Product::query()->with('template')->where('sku', 'A018')->firstOrFail();
    $oliveOil = Product::query()->with(['baseUnit', 'contentUnit'])->where('sku', 'A378')->firstOrFail();

    expect(ProductTemplate::query()->where('is_pos_visible', true)->count())->toBe(0)
        ->and($flour->template?->is_pos_visible)->toBeFalse()
        ->and($textPrice->template?->description)->toContain('30 - 25')
        ->and($oliveOil->sale_mode)->toBe('unit')
        ->and($oliveOil->baseUnit?->code)->toBe('NIU')
        ->and($oliveOil->content_quantity)->toBeNull()
        ->and($oliveOil->contentUnit)->toBeNull();
});

it('only expands the explicit H abbreviation as harina', function (): void {
    $this->seed(MayoreoProductCatalogSeeder::class);

    expect(Product::query()->where('sku', 'A001')->firstOrFail()->template?->name)
        ->toBe('Harina 7 semillas')
        ->and(Product::query()->where('sku', 'A074')->firstOrFail()->template?->name)
        ->toBe('Habas enteras')
        ->and(Product::query()->where('sku', 'A151')->firstOrFail()->template?->name)
        ->toBe('Habas fritas (Abeja)')
        ->and(Product::query()->where('sku', 'A131')->firstOrFail()->template?->name)
        ->toBe('Hoja de moringa')
        ->and(Product::query()->where('sku', 'A369')->firstOrFail()->template?->name)
        ->toBe('Hongos');
});

it('can run repeatedly without duplicating catalog records or hiding templates enabled for the POS', function (): void {
    $this->seed(MayoreoProductCatalogSeeder::class);

    $templateCount = ProductTemplate::query()->count();
    $productCount = Product::query()->count();
    $enabledTemplate = Product::query()->where('sku', 'A001')->firstOrFail()->template;
    $enabledTemplate?->update(['is_pos_visible' => true]);

    $this->seed(MayoreoProductCatalogSeeder::class);

    expect(ProductTemplate::query()->count())->toBe($templateCount)
        ->and(Product::query()->count())->toBe($productCount)
        ->and($enabledTemplate?->fresh()?->is_pos_visible)->toBeTrue();
});
