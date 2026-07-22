<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Product;
use App\Models\ProductPurchaseUnit;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProductPurchaseUnit>
 */
final class ProductPurchaseUnitFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'product_id' => Product::factory(),
            'name' => fake()->words(2, true),
            'conversion_factor' => fake()->randomFloat(6, 1, 50000),
            'barcode' => fake()->optional()->ean13(),
            'is_default_purchase' => false,
        ];
    }
}
