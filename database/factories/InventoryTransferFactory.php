<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\InventoryTransfer;
use App\Models\Warehouse;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<InventoryTransfer>
 */
final class InventoryTransferFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'from_warehouse_id' => Warehouse::factory(),
            'to_warehouse_id' => Warehouse::factory(),
            'status' => 'draft',
            'dispatched_at' => null,
            'received_at' => null,
            'notes' => null,
        ];
    }
}
