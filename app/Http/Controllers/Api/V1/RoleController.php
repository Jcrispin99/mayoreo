<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\StoreRoleRequest;
use App\Http\Requests\Api\V1\UpdateRoleRequest;
use App\Http\Resources\RoleResource;
use Illuminate\Http\JsonResponse;
use Spatie\Permission\Models\Role;

final class RoleController extends ApiController
{
    public function index(): JsonResponse
    {
        $roles = Role::query()->where('guard_name', 'web')->with('permissions')->orderBy('name')->get();

        return $this->success(RoleResource::collection($roles));
    }

    public function store(StoreRoleRequest $request): JsonResponse
    {
        $role = Role::query()->create(['name' => $request->name, 'guard_name' => 'web']);

        if ($request->has('permissions')) {
            $role->syncPermissions($request->array('permissions'));
        }

        return $this->created(new RoleResource($role->load('permissions')));
    }

    public function show(Role $role): JsonResponse
    {
        return $this->success(new RoleResource($role->load('permissions')));
    }

    public function update(UpdateRoleRequest $request, Role $role): JsonResponse
    {
        if ($request->has('name')) {
            $role->update(['name' => $request->name]);
        }

        if ($request->has('permissions')) {
            $role->syncPermissions($request->array('permissions'));
        }

        return $this->success(new RoleResource($role->load('permissions')), 'Role updated successfully');
    }

    public function destroy(Role $role): JsonResponse
    {
        $role->delete();

        return $this->noContent();
    }
}
