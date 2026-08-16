<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\UnitOfMeasure;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<UnitOfMeasure>
 */
final class UnitOfMeasureFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'code' => fake()->unique()->lexify('u-???'),
            'name' => fake()->words(2, true),
            'type' => fake()->randomElement(['weight', 'volume', 'count']),
        ];
    }

    public function grams(): static
    {
        return $this->state(fn (array $attributes): array => [
            'code' => 'g',
            'name' => 'Gramos',
            'type' => 'weight',
        ]);
    }

    public function kilograms(): static
    {
        return $this->state(fn (array $attributes): array => [
            'code' => 'kg',
            'name' => 'Kilogramos',
            'type' => 'weight',
        ]);
    }

    public function milliliters(): static
    {
        return $this->state(fn (array $attributes): array => [
            'code' => 'ml',
            'name' => 'Mililitros',
            'type' => 'volume',
        ]);
    }

    public function units(): static
    {
        return $this->state(fn (array $attributes): array => [
            'code' => 'NIU',
            'name' => 'Unidad',
            'type' => 'count',
        ]);
    }
}
