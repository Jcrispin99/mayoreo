<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

final class RolePermissionSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed roles, permissions and a set of test users for each role.
     */
    public function run(): void
    {
        $permissions = [
            'stores.view', 'stores.manage',
            'warehouses.view', 'warehouses.manage',
            'products.view', 'products.manage',
            'stock.view', 'stock.manage',
            'suppliers.view', 'suppliers.manage',
            'purchase-orders.view', 'purchase-orders.manage',
            'inventory-transfers.view', 'inventory-transfers.manage',
            'sales.view', 'sales.manage',
            'pos-config.view', 'pos-config.manage',
            'cash-sessions.view', 'cash-sessions.manage',
            'users.view', 'users.manage',
            'roles.view', 'roles.manage',
        ];

        foreach ($permissions as $permission) {
            Permission::query()->firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
        }

        $admin = Role::query()->firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $admin->syncPermissions($permissions);

        $manager = Role::query()->firstOrCreate(['name' => 'manager', 'guard_name' => 'web']);
        $manager->syncPermissions([
            'stores.view', 'warehouses.view',
            'products.view', 'products.manage',
            'stock.view', 'stock.manage',
            'suppliers.view', 'suppliers.manage',
            'purchase-orders.view', 'purchase-orders.manage',
            'inventory-transfers.view', 'inventory-transfers.manage',
            'sales.view', 'sales.manage',
            'pos-config.view', 'pos-config.manage',
            'cash-sessions.view', 'cash-sessions.manage',
        ]);

        $cashier = Role::query()->firstOrCreate(['name' => 'cashier', 'guard_name' => 'web']);
        $cashier->syncPermissions([
            'products.view',
            'stock.view',
            'sales.view', 'sales.manage',
            'cash-sessions.view', 'cash-sessions.manage',
        ]);

        $viewer = Role::query()->firstOrCreate(['name' => 'viewer', 'guard_name' => 'web']);
        $viewer->syncPermissions([
            'stores.view', 'warehouses.view',
            'products.view', 'stock.view',
            'suppliers.view', 'purchase-orders.view',
            'inventory-transfers.view', 'sales.view',
            'cash-sessions.view',
        ]);

        $users = [
            ['name' => 'Admin User', 'email' => 'admin@mayoreo.test', 'role' => $admin],
            ['name' => 'Manager User', 'email' => 'manager@mayoreo.test', 'role' => $manager],
            ['name' => 'Cashier User', 'email' => 'cashier@mayoreo.test', 'role' => $cashier],
            ['name' => 'Viewer User', 'email' => 'viewer@mayoreo.test', 'role' => $viewer],
        ];

        foreach ($users as $data) {
            $user = User::query()->firstOrCreate(
                ['email' => $data['email']],
                [
                    'name' => $data['name'],
                    'password' => Hash::make('password'),
                    'email_verified_at' => now(),
                ]
            );

            $user->syncRoles([$data['role']->name]);
        }
    }
}
