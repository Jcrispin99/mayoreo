<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\CashRegister;
use App\Models\DocumentSeries;
use App\Models\Store;
use App\Models\Warehouse;
use Illuminate\Database\Seeder;

final class CashRegisterSeeder extends Seeder
{
    public function run(): void
    {
        $store = Store::query()->where('code', 'PRINCIPAL')->first() ?? Store::query()->first();

        if (! $store instanceof Store) {
            return;
        }

        $warehouse = Warehouse::query()
            ->where('store_id', $store->id)
            ->where('type', 'pos')
            ->first()
            ?? Warehouse::query()->where('store_id', $store->id)->where('is_default', true)->first();

        if (! $warehouse instanceof Warehouse) {
            return;
        }

        $salesSeries = DocumentSeries::query()
            ->where('document_type', 'sales_ticket')
            ->where('series_code', 'NV01')
            ->first();

        $cashRegister = CashRegister::query()->firstOrCreate(
            ['store_id' => $store->id, 'code' => 'CAJA-01'],
            [
                'warehouse_id' => $warehouse->id,
                'default_sales_series_id' => $salesSeries?->id,
                'name' => 'Caja principal',
                'is_active' => true,
            ],
        );

        if ($salesSeries instanceof DocumentSeries) {
            $cashRegister->salesSeries()->syncWithoutDetaching([$salesSeries->id]);
        }
    }
}
