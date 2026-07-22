<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\AssignRoleRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;

final class UserRoleController extends ApiController
{
    public function update(AssignRoleRequest $request, User $user): JsonResponse
    {
        $user->syncRoles($request->array('roles'));

        return $this->success(new UserResource($user->load('roles')), 'User roles updated successfully');
    }
}
