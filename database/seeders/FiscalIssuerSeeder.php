<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Enums\SunatEnvironment;
use App\Models\DocumentSeries;
use App\Models\FiscalIssuer;
use App\Models\Store;
use Illuminate\Database\Seeder;

/**
 * Seeds the business's real SUNAT fiscal identity (RUC, domicilio fiscal) and
 * links it to the store, its operational series (NV01/B001/F001/BC01/FC01), and
 * the dedicated B901 series used for the Yape historical-sale import. The
 * Clave SOL password and digital certificate are never seeded here — those
 * stay encrypted in the database, loaded once through the app's SUNAT
 * settings screen, so they never end up in source control.
 */
final class FiscalIssuerSeeder extends Seeder
{
    public function run(): void
    {
        $issuer = FiscalIssuer::query()->updateOrCreate(
            ['ruc' => '10759997676'],
            [
                'legal_name' => 'BONIFACIO POVIS FRANC RUSELL',
                'trade_name' => 'BONI',
                'fiscal_address' => 'Jr. San Martín S/N Int. 266',
                'ubigeo' => '100101',
                'urbanization' => 'Mercado Modelo',
                'department' => 'HUANUCO',
                'province' => 'HUANUCO',
                'district' => 'HUANUCO',
                'phone' => '961652338',
                'email' => 'ruselbonifaciopovis@gmail.com',
                'is_active' => true,
            ],
        );

        $issuer->credential()->firstOrCreate([], [
            'environment' => SunatEnvironment::Beta,
        ]);

        Store::query()
            ->where(fn ($query) => $query->whereNull('fiscal_issuer_id')->orWhere('fiscal_issuer_id', $issuer->id))
            ->update([
                'fiscal_issuer_id' => $issuer->id,
                'sunat_establishment_code' => '0000',
                'sunat_address' => 'Jr. San Martín S/N Int. 266',
                'sunat_ubigeo' => '100101',
                'sunat_urbanization' => 'Mercado Modelo',
                'sunat_department' => 'HUANUCO',
                'sunat_province' => 'HUANUCO',
                'sunat_district' => 'HUANUCO',
            ]);

        // The pre-existing operational series were seeded without an issuer;
        // now that the business's RUC is known, they belong to it too.
        foreach ([
            ['document_type' => 'sales_ticket', 'series_code' => 'NV01'],
            ['document_type' => 'receipt', 'series_code' => 'B001'],
            ['document_type' => 'invoice', 'series_code' => 'F001'],
        ] as $operational) {
            DocumentSeries::query()
                ->where('document_type', $operational['document_type'])
                ->where('series_code', $operational['series_code'])
                ->where(fn ($query) => $query->whereNull('fiscal_issuer_id')->orWhere('fiscal_issuer_id', $issuer->id))
                ->update(['fiscal_issuer_id' => $issuer->id]);
        }

        DocumentSeries::query()->firstOrCreate(
            [
                'fiscal_issuer_id' => $issuer->id,
                'document_type' => 'receipt',
                'series_code' => 'B901',
            ],
            [
                'purpose' => 'historical_import',
                'current_number' => 0,
                'is_active' => true,
            ],
        );

        foreach (['BC01', 'FC01'] as $creditNoteSeries) {
            DocumentSeries::query()->firstOrCreate(
                [
                    'fiscal_issuer_id' => $issuer->id,
                    'document_type' => 'credit_note',
                    'series_code' => $creditNoteSeries,
                ],
                [
                    'purpose' => 'operational',
                    'current_number' => 0,
                    'is_active' => true,
                ],
            );
        }
    }
}
