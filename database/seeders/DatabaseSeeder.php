<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
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
        // User::factory(10)->create();

        User::factory()->create([
            'name' => 'admin',
            'email' => 'admin@gmail.com',
            'password' =>'password',
        ]);

        $this->call(DocumentSeriesSeeder::class);
        $this->call(WarehouseSeeder::class);
        $this->call(CashRegisterSeeder::class);
        $this->call(RolePermissionSeeder::class);
        $this->call(PurchaseOrderSeeder::class);
    }
}
