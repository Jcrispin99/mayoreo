<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Store;
use App\Models\Warehouse;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Warehouse>
 */
final class WarehouseFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'store_id' => Store::factory(),
            'code' => fake()->unique()->bothify('WH-####'),
            'name' => fake()->company(),
            'type' => fake()->randomElement(['main', 'retail', 'pos']),
            'is_active' => true,
            'is_default' => false,
        ];
    }

    public function main(): static
    {
        return $this->state(fn (array $attributes): array => [
            'code' => 'MAIN',
            'name' => 'Almacén Principal',
            'type' => 'main',
        ]);
    }

    public function retail(): static
    {
        return $this->state(fn (array $attributes): array => [
            'code' => 'RETAIL',
            'name' => 'Almacén Minorista',
            'type' => 'retail',
        ]);
    }

    public function pos(): static
    {
        return $this->state(fn (array $attributes): array => [
            'code' => 'POS',
            'name' => 'Almacén Ventas Rápidas',
            'type' => 'pos',
        ]);
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes): array => [
            'is_active' => false,
        ]);
    }
}
