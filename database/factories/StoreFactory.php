<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Store;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Store>
 */
final class StoreFactory extends Factory
{
    public function definition(): array
    {
        return [
            'code' => fake()->unique()->bothify('STORE-###'),
            'name' => fake()->company(),
            'address' => fake()->address(),
            'phone' => fake()->phoneNumber(),
            'is_active' => true,
        ];
    }
}
