<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\InventoryTransfer;
use App\Models\Product;
use App\Models\Productable;
use App\Models\PurchaseOrder;
use App\Models\Sale;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Productable>
 */
final class ProductableFactory extends Factory
{
    protected $model = Productable::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'product_id' => Product::factory(),
            'quantity' => fake()->randomFloat(6, 1, 100),
        ];
    }

    public function purchaseOrderItem(): static
    {
        return $this->state(function (): array {
            $quantity = fake()->randomFloat(6, 1, 100);

            return [
                'productable_type' => PurchaseOrder::class,
                'productable_id' => PurchaseOrder::factory(),
                'quantity' => $quantity,
                'quantity_purchased' => $quantity,
                'unit_cost' => fake()->randomFloat(4, 1, 20),
            ];
        });
    }

    public function saleItem(): static
    {
        return $this->state(function (): array {
            $quantity = fake()->randomFloat(6, 1, 100);
            $unitPrice = fake()->randomFloat(4, 1, 20);

            return [
                'productable_type' => Sale::class,
                'productable_id' => Sale::factory(),
                'quantity' => $quantity,
                'input_quantity' => $quantity,
                'unit_price' => $unitPrice,
                'line_total' => $quantity * $unitPrice,
            ];
        });
    }

    public function transferItem(): static
    {
        return $this->state(fn (): array => [
            'productable_type' => InventoryTransfer::class,
            'productable_id' => InventoryTransfer::factory(),
            'unit_cost' => fake()->randomFloat(4, 1, 20),
        ]);
    }
}
