<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Store;
use App\Models\Warehouse;
use Illuminate\Database\Seeder;

final class WarehouseSeeder extends Seeder
{
    /**
     * Seed the 3 fixed-role warehouses: Principal, Minorista, Ventas Rápidas.
     */
    public function run(): void
    {
        $store = Store::query()->firstOrCreate(
            ['code' => 'PRINCIPAL'],
            ['name' => 'Tienda principal', 'is_active' => true],
        );

        $warehouses = [
            ['code' => 'MAIN', 'name' => 'Almacén Principal', 'type' => 'main', 'is_default' => true],
            ['code' => 'RETAIL', 'name' => 'Almacén Minorista', 'type' => 'retail', 'is_default' => false],
            ['code' => 'POS', 'name' => 'Almacén Ventas Rápidas', 'type' => 'pos', 'is_default' => false],
        ];

        foreach ($warehouses as $warehouse) {
            Warehouse::query()->updateOrCreate(
                ['code' => $warehouse['code']],
                [
                    'store_id' => $store->id,
                    'name' => $warehouse['name'],
                    'type' => $warehouse['type'],
                    'is_default' => $warehouse['is_default'],
                    'is_active' => true,
                ],
            );
        }
    }
}
