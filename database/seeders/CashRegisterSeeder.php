<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\CashRegister;
use App\Models\DocumentSeries;
use App\Models\Store;
use App\Models\Warehouse;
use Illuminate\Database\Seeder;

/**
 * Seeds three registers (CAJA-01..03), each with its own nota de venta series
 * (NV01..03) as its default and only assigned series. The boleta and factura
 * series (B001..003, F001..003) are intentionally left unassigned so they can
 * be assigned to each register from the app.
 */
final class CashRegisterSeeder extends Seeder
{
    private const REGISTER_COUNT = 3;

    public function run(): void
    {
        $store = Store::query()->where('code', 'PRINCIPAL')->first() ?? Store::query()->first();

        if (! $store instanceof Store) {
            return;
        }

        $warehouse = Warehouse::query()
            ->where('store_id', $store->id)
            ->where('code', 'MAIN')
            ->first()
            ?? Warehouse::query()->where('store_id', $store->id)->where('is_default', true)->first();

        if (! $warehouse instanceof Warehouse) {
            return;
        }

        for ($number = 1; $number <= self::REGISTER_COUNT; $number++) {
            $salesTicketSeries = DocumentSeries::query()
                ->where('fiscal_issuer_id', $store->fiscal_issuer_id)
                ->where('document_type', 'sales_ticket')
                ->where('series_code', sprintf('NV%02d', $number))
                ->first();

            $cashRegister = CashRegister::query()->updateOrCreate(
                ['store_id' => $store->id, 'code' => sprintf('CAJA-%02d', $number)],
                [
                    'warehouse_id' => $warehouse->id,
                    'default_sales_series_id' => $salesTicketSeries?->id,
                    'name' => "Caja {$number}",
                    'is_active' => true,
                ],
            );

            // sync, not attach: a re-seed must also drop the boleta/factura
            // series the previous version of this seeder assigned to CAJA-01.
            $cashRegister->salesSeries()->sync(
                $salesTicketSeries instanceof DocumentSeries ? [$salesTicketSeries->id] : [],
            );
        }
    }
}
