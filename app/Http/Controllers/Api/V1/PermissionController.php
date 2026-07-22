<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\ApiController;
use App\Http\Resources\PermissionResource;
use Illuminate\Http\JsonResponse;
use Spatie\Permission\Models\Permission;

final class PermissionController extends ApiController
{
    public function index(): JsonResponse
    {
        $permissions = Permission::query()->where('guard_name', 'web')->orderBy('name')->get();

        return $this->success(PermissionResource::collection($permissions));
    }
}
