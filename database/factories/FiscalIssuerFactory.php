<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\FiscalIssuer;
use App\Support\PeruvianRuc;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FiscalIssuer>
 */
final class FiscalIssuerFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $rucBase = '20'.fake()->unique()->numerify('########');

        return [
            'ruc' => PeruvianRuc::complete($rucBase),
            'legal_name' => fake()->company(),
            'trade_name' => fake()->company(),
            'fiscal_address' => fake()->address(),
            'ubigeo' => fake()->numerify('######'),
            'department' => 'Lima',
            'province' => 'Lima',
            'district' => 'Lima',
            'phone' => fake()->phoneNumber(),
            'email' => fake()->companyEmail(),
            'is_active' => true,
        ];
    }
}
