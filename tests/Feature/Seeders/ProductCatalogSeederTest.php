<?php

declare(strict_types=1);

use App\Actions\Sales\ResolveSaleStockConsumptionAction;
use App\Models\PriceTier;
use App\Models\Product;
use Database\Seeders\ProductCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('keeps independent unit variants on their own stock', function (): void {
    $this->seed(ProductCatalogSeeder::class);

    $drum = Product::query()
        ->where('sku', 'ACEITE-VEGETAL-BIDON-20L')
        ->firstOrFail();

    $consumption = app(ResolveSaleStockConsumptionAction::class)->execute(
        $drum,
        '1',
        false,
    );

    expect($drum->baseUnit()->firstOrFail()->code)->toBe('NIU')
        ->and($drum->content_quantity)->toBeNull()
        ->and($drum->content_unit_id)->toBeNull()
        ->and($consumption->product->id)->toBe($drum->id)
        ->and($consumption->quantity)->toBe('1.000000');
});

it('keeps packaged weight variants consuming principal stock', function (): void {
    $this->seed(ProductCatalogSeeder::class);

    $sack = Product::query()
        ->where('sku', 'ARROZ-EXTRA-SACO-50KG')
        ->firstOrFail();
    $principal = Product::query()
        ->where('sku', 'ARROZ-EXTRA-KG')
        ->firstOrFail();

    $consumption = app(ResolveSaleStockConsumptionAction::class)->execute(
        $sack,
        '2',
        false,
    );

    expect($consumption->product->id)->toBe($principal->id)
        ->and($consumption->quantity)->toBe('100.000000');
});

it('can reseed catalog prices without replacing their identifiers', function (): void {
    $this->seed(ProductCatalogSeeder::class);

    $tierIds = PriceTier::query()
        ->orderBy('id')
        ->pluck('id')
        ->all();

    $this->seed(ProductCatalogSeeder::class);

    expect(PriceTier::query()->orderBy('id')->pluck('id')->all())
        ->toBe($tierIds);
});
