<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        $permissionId = DB::table('permissions')
            ->where('name', 'price-notifications.receive')
            ->where('guard_name', 'web')
            ->value('id');

        if (! is_numeric($permissionId)) {
            $permissionId = DB::table('permissions')->insertGetId([
                'name' => 'price-notifications.receive',
                'guard_name' => 'web',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        foreach (['admin', 'manager', 'cashier'] as $roleName) {
            $roleId = DB::table('roles')
                ->where('name', $roleName)
                ->where('guard_name', 'web')
                ->value('id');

            if (is_numeric($roleId)) {
                DB::table('role_has_permissions')->insertOrIgnore([
                    'permission_id' => (int) $permissionId,
                    'role_id' => (int) $roleId,
                ]);
            }
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        // Preserve assignments because deployments may customize notification recipients.
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
