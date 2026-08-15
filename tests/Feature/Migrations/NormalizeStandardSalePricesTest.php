<?php

declare(strict_types=1);

use App\Models\PriceTier;
use App\Models\Product;
use App\Models\ProductTemplate;
use App\Models\UnitOfMeasure;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('normalizes standard prices and keeps package rates unchanged', function (): void {
    $kilograms = UnitOfMeasure::factory()->create([
        'code' => 'kg',
        'name' => 'Kilogramos',
        'type' => 'weight',
    ]);
    $template = ProductTemplate::query()->create([
        'name' => 'Bicarbonato',
        'is_active' => true,
        'is_pos_visible' => true,
    ]);
    $product = Product::factory()->create([
        'product_template_id' => $template->id,
        'base_unit_id' => $kilograms->id,
        'name' => 'Bicarbonato - Granel',
        'sale_mode' => 'measured',
        'is_principal' => true,
    ]);
    PriceTier::factory()->for($product)->create([
        'label' => 'Menudeo',
        'min_quantity' => 0.001,
        'max_quantity' => 0.999999,
        'unit_price' => 6,
    ]);
    PriceTier::factory()->for($product)->create([
        'label' => 'Por kilo',
        'min_quantity' => 1,
        'max_quantity' => 24.999999,
        'unit_price' => 4.9959,
    ]);
    PriceTier::factory()->for($product)->create([
        'label' => 'Cliente / saco 25 kg (total S/ 122.50)',
        'min_quantity' => 25,
        'max_quantity' => null,
        'unit_price' => 4.9,
    ]);

    $migration = require database_path('migrations/2026_08_14_020000_normalize_standard_sale_prices.php');
    $migration->up();

    $this->assertDatabaseHas('price_tiers', [
        'product_id' => $product->id,
        'label' => 'Por kilo',
        'unit_price' => 5,
    ]);
    $this->assertDatabaseHas('price_tiers', [
        'product_id' => $product->id,
        'label' => 'Cliente / saco 25 kg (total S/ 122.50)',
        'unit_price' => 4.9,
    ]);
});
