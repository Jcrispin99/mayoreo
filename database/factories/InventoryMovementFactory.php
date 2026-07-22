<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\Warehouse;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<InventoryMovement>
 */
final class InventoryMovementFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $quantity = fake()->randomFloat(6, 1, 1000);

        return [
            'product_id' => Product::factory(),
            'warehouse_id' => Warehouse::factory(),
            'type' => 'purchase',
            'quantity' => $quantity,
            'direction' => null,
            'unit_cost' => fake()->randomFloat(4, 1, 20),
            'balance_quantity' => $quantity,
            'balance_unit_cost' => fake()->randomFloat(4, 1, 20),
            'balance_total_cost' => fake()->randomFloat(4, 1, 1000),
            'reference_type' => null,
            'reference_id' => null,
            'notes' => null,
            'created_by' => null,
        ];
    }
}
