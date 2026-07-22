<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\DocumentSeries;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DocumentSeries>
 */
final class DocumentSeriesFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'document_type' => 'sales_ticket',
            'series_code' => 'NV01',
            'current_number' => 0,
            'is_active' => true,
        ];
    }

    /**
     * Indicate that the series is inactive.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes): array => [
            'is_active' => false,
        ]);
    }
}
