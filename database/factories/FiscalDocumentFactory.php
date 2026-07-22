<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\FiscalDocument;
use App\Models\Sale;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FiscalDocument>
 */
final class FiscalDocumentFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'sale_id' => Sale::factory(),
            'document_type' => 'sales_ticket',
            'series_code' => 'NV01',
            'number' => fake()->unique()->numberBetween(1, 100000),
            'status' => 'issued',
            'exchanged_from_document_id' => null,
            'issued_at' => now(),
        ];
    }
}
