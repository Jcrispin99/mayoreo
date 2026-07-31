<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Product;
use App\Models\UnitOfMeasure;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Product>
 */
final class ProductFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'sku' => fake()->unique()->bothify('SKU-####'),
            'barcode' => fake()->unique()->ean13(),
            'name' => fake()->words(3, true),
            'description' => fake()->optional()->sentence(),
            'base_unit_id' => fn () => UnitOfMeasure::query()->firstOrCreate(
                ['code' => 'g'],
                ['name' => 'Gramos', 'type' => 'weight'],
            )->id,
            'sale_mode' => 'measured',
            'is_active' => true,
            'is_favorite' => false,
        ];
    }
}
