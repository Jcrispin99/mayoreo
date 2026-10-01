<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\DocumentSeries;
use Illuminate\Database\Seeder;

final class DocumentSeriesSeeder extends Seeder
{
    /**
     * Seed the default document series: compras, one nota de venta per cash
     * register (NV01-NV03), and three boleta/factura series each.
     */
    public function run(): void
    {
        $series = [
            ['document_type' => 'purchase', 'series_code' => 'OC01'],
            ['document_type' => 'sales_ticket', 'series_code' => 'NV01'],
            ['document_type' => 'sales_ticket', 'series_code' => 'NV02'],
            ['document_type' => 'sales_ticket', 'series_code' => 'NV03'],
            ['document_type' => 'receipt', 'series_code' => 'B001'],
            ['document_type' => 'receipt', 'series_code' => 'B002'],
            ['document_type' => 'receipt', 'series_code' => 'B003'],
            ['document_type' => 'invoice', 'series_code' => 'F001'],
            ['document_type' => 'invoice', 'series_code' => 'F002'],
            ['document_type' => 'invoice', 'series_code' => 'F003'],
        ];

        foreach ($series as $entry) {
            DocumentSeries::query()->updateOrCreate(
                ['document_type' => $entry['document_type'], 'series_code' => $entry['series_code']],
                ['purpose' => 'operational', 'is_active' => true],
            );
        }
    }
}
