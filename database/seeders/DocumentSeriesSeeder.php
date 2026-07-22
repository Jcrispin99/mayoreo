<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\DocumentSeries;
use Illuminate\Database\Seeder;

final class DocumentSeriesSeeder extends Seeder
{
    /**
     * Seed the default document series (compras, nota de venta, boleta, factura).
     */
    public function run(): void
    {
        $series = [
            ['document_type' => 'purchase', 'series_code' => 'OC01'],
            ['document_type' => 'sales_ticket', 'series_code' => 'NV01'],
            ['document_type' => 'receipt', 'series_code' => 'B001'],
            ['document_type' => 'invoice', 'series_code' => 'F001'],
        ];

        foreach ($series as $entry) {
            DocumentSeries::query()->firstOrCreate(
                ['document_type' => $entry['document_type'], 'series_code' => $entry['series_code']],
                ['current_number' => 0, 'is_active' => true],
            );
        }
    }
}
