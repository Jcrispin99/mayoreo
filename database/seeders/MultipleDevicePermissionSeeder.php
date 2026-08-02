<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Services\DeviceSessionService;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

final class MultipleDevicePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permission = Permission::findOrCreate(DeviceSessionService::MULTIPLE_DEVICES_PERMISSION, 'web');
        $admin = Role::findOrCreate('admin', 'web');

        $admin->givePermissionTo($permission);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
