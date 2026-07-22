<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Sale;
use App\Models\Warehouse;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Sale>
 */
final class SaleFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'warehouse_id' => Warehouse::factory(),
            'customer_name' => fake()->optional()->name(),
            'customer_document' => null,
            'status' => 'completed',
            'subtotal' => 0,
            'total' => 0,
            'sold_at' => now(),
        ];
    }
}
