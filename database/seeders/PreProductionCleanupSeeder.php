<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Enums\SunatEnvironment;
use App\Models\DocumentSeries;
use App\Models\FiscalCredential;
use App\Models\FiscalIssuer;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Removes test operations before the first production cutover.
 *
 * It intentionally preserves users, permissions, catalogues, stores,
 * warehouses, fiscal issuers, SOL credentials and the digital certificate.
 * This seeder is destructive and must never be added to DatabaseSeeder.
 */
final class PreProductionCleanupSeeder extends Seeder
{
    private const CONFIRMATION = '10759997676';

    public function run(): void
    {
        if (env('PRE_PRODUCTION_CLEANUP_CONFIRM') !== self::CONFIRMATION) {
            throw new RuntimeException(
                'Limpieza cancelada. Define PRE_PRODUCTION_CLEANUP_CONFIRM con el RUC del emisor para confirmar.',
            );
        }

        if (FiscalCredential::query()
            ->where('environment', SunatEnvironment::Production->value)
            ->exists()) {
            throw new RuntimeException(
                'Limpieza cancelada: existe un emisor configurado en producción. Este seeder solo puede ejecutarse antes del corte productivo.',
            );
        }

        DB::transaction(function (): void {
            // Prevent queued beta documents from being sent after the cleanup.
            DB::table('jobs')->delete();
            DB::table('failed_jobs')->delete();
            DB::table('job_batches')->delete();

            DB::table('historical_sale_import_rows')->delete();
            DB::table('historical_sale_imports')->delete();

            DB::table('pos_supply_request_changes')->delete();
            DB::table('pos_supply_request_items')->delete();
            DB::table('pos_supply_requests')->delete();

            DB::table('sale_payments')->delete();

            // Break the two self-references before deleting every beta CPE.
            DB::table('fiscal_documents')->update([
                'affected_document_id' => null,
                'exchanged_from_document_id' => null,
            ]);
            DB::table('fiscal_documents')->delete();

            // These are the detail rows of sales, purchases and transfers.
            DB::table('productables')->delete();
            DB::table('sales')->delete();
            DB::table('inventory_transfers')->delete();
            DB::table('pos_orders')->delete();
            DB::table('cash_register_movements')->delete();
            DB::table('cash_register_sessions')->delete();
            DB::table('purchase_orders')->delete();

            // Start production inventory from an explicit, auditable opening load.
            DB::table('inventory_movements')->delete();
            DB::table('stocks')->delete();

            DB::table('notifications')->delete();

            DocumentSeries::query()->update(['current_number' => 0]);

            FiscalIssuer::query()->eachById(static function (FiscalIssuer $issuer): void {
                foreach (['BC01', 'FC01'] as $seriesCode) {
                    DocumentSeries::query()->updateOrCreate(
                        [
                            'fiscal_issuer_id' => $issuer->id,
                            'document_type' => 'credit_note',
                            'series_code' => $seriesCode,
                        ],
                        [
                            'purpose' => 'operational',
                            'current_number' => 0,
                            'is_active' => true,
                        ],
                    );
                }
            });
        });

        $this->command?->info(
            'Datos de prueba eliminados. Usuarios, catálogo, locales, almacenes y configuración SUNAT fueron conservados.',
        );
        $this->command?->warn(
            'El inventario quedó en cero. Registra o siembra la carga inicial antes de abrir ventas.',
        );
    }
}
