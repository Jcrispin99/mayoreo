<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    /** @var list<string> */
    private const PERMISSIONS = [
        'customers.view',
        'customers.manage',
    ];

    public function up(): void
    {
        $permissionIds = [];

        foreach (self::PERMISSIONS as $permissionName) {
            $permissionId = DB::table('permissions')
                ->where('name', $permissionName)
                ->where('guard_name', 'web')
                ->value('id');

            if (! is_numeric($permissionId)) {
                $permissionId = DB::table('permissions')->insertGetId([
                    'name' => $permissionName,
                    'guard_name' => 'web',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $permissionIds[$permissionName] = (int) $permissionId;
        }

        $this->assignToRole('admin', array_values($permissionIds));
        $this->assignToRole('manager', array_values($permissionIds));
        $this->assignToRole('cashier', array_values($permissionIds));
        $this->assignToRole('viewer', [$permissionIds['customers.view']]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        // Deliberately preserve permissions and assignments: they may have existed
        // before this migration or been customized after deployment.
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    /**
     * @param  list<int>  $permissionIds
     */
    private function assignToRole(string $roleName, array $permissionIds): void
    {
        $roleId = DB::table('roles')
            ->where('name', $roleName)
            ->where('guard_name', 'web')
            ->value('id');

        if (! is_numeric($roleId)) {
            return;
        }

        foreach ($permissionIds as $permissionId) {
            DB::table('role_has_permissions')->insertOrIgnore([
                'permission_id' => $permissionId,
                'role_id' => (int) $roleId,
            ]);
        }
    }
};
