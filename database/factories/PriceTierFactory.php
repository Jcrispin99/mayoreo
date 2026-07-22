<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\PriceTier;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PriceTier>
 */
final class PriceTierFactory extends Factory
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
            'min_quantity' => 0,
            'max_quantity' => null,
            'unit_price' => fake()->randomFloat(4, 1, 50),
            'label' => fake()->words(2, true),
            'is_active' => true,
        ];
    }
}
