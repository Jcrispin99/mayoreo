<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

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
            'customers.view', 'customers.manage',
            'pos-config.view', 'pos-config.manage',
            'cash-sessions.view', 'cash-sessions.manage',
            'users.view', 'users.manage',
            'roles.view', 'roles.manage',
            'employees.view', 'employees.manage',
            'attendance.mark', 'attendance.view-own', 'attendance.view', 'attendance.manage',
            'attendance-qr.manage',
            'payroll.view-own', 'payroll.view', 'payroll.manage',
            'fiscal-settings.view', 'fiscal-settings.manage',
            'fiscal-credentials.manage',
            'auth.multiple-devices',
            'pos-supply-requests.assign',
            'pos-supply-requests.view-assigned',
            'pos-supply-requests.resolve-assigned',
            'pos-supply-requests.prepare-assigned',
            'price-notifications.receive',
        ];

        foreach ($permissions as $permission) {
            Permission::query()->firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

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
            'customers.view', 'customers.manage',
            'pos-config.view', 'pos-config.manage',
            'cash-sessions.view', 'cash-sessions.manage',
            'fiscal-settings.view',
            'employees.view', 'employees.manage',
            'attendance.mark', 'attendance.view-own', 'attendance.view', 'attendance.manage',
            'attendance-qr.manage',
            'payroll.view-own', 'payroll.view', 'payroll.manage',
            'pos-supply-requests.assign',
            'price-notifications.receive',
        ]);

        $cashier = Role::query()->firstOrCreate(['name' => 'cashier', 'guard_name' => 'web']);
        $cashier->syncPermissions([
            'products.view',
            'stock.view',
            'sales.view', 'sales.manage',
            'customers.view', 'customers.manage',
            'cash-sessions.view', 'cash-sessions.manage',
            'attendance.mark', 'attendance.view-own', 'payroll.view-own',
            'pos-supply-requests.assign',
            'price-notifications.receive',
        ]);

        $warehouse = Role::query()->firstOrCreate(['name' => 'warehouse', 'guard_name' => 'web']);
        $warehouse->syncPermissions([
            'pos-supply-requests.view-assigned',
            'pos-supply-requests.resolve-assigned',
            'pos-supply-requests.prepare-assigned',
            'attendance.mark', 'attendance.view-own', 'payroll.view-own',
        ]);

        $viewer = Role::query()->firstOrCreate(['name' => 'viewer', 'guard_name' => 'web']);
        $viewer->syncPermissions([
            'stores.view', 'warehouses.view',
            'products.view', 'stock.view',
            'suppliers.view', 'purchase-orders.view',
            'inventory-transfers.view', 'sales.view',
            'customers.view',
            'cash-sessions.view',
        ]);

        $users = [
            ['name' => 'Administrador', 'email' => 'admin@gmail.com', 'role' => $admin],
            ['name' => 'Admin User', 'email' => 'admin@mayoreo.test', 'role' => $admin],
            ['name' => 'Manager User', 'email' => 'manager@mayoreo.test', 'role' => $manager],
            ['name' => 'Cashier User', 'email' => 'cashier@mayoreo.test', 'role' => $cashier],
            ['name' => 'Viewer User', 'email' => 'viewer@mayoreo.test', 'role' => $viewer],
            ['name' => 'Warehouse User', 'email' => 'warehouse@mayoreo.test', 'role' => $warehouse],
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
