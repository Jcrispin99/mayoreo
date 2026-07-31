<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

final class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(DocumentSeriesSeeder::class);
        $this->call(WarehouseSeeder::class);
        $this->call(CashRegisterSeeder::class);
        $this->call(RolePermissionSeeder::class);
        $this->call(ProductCatalogSeeder::class);
        $this->call(PurchaseOrderSeeder::class);
    }
}
