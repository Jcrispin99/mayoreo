<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\StoreUserRequest;
use App\Http\Requests\Api\V1\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;

final class UserController extends ApiController
{
    public function index(): JsonResponse
    {
        $users = User::query()->with(['roles', 'employeeProfile.store'])->orderBy('name')->get();

        return $this->success(UserResource::collection($users));
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $user = User::query()->create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
        ]);

        return $this->created(new UserResource($user->load(['roles', 'employeeProfile.store'])));
    }

    public function show(User $user): JsonResponse
    {
        return $this->success(new UserResource($user->load(['roles', 'employeeProfile.store'])));
    }

    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        $user->update(array_filter([
            'name' => $request->input('name'),
            'email' => $request->input('email'),
            'password' => $request->filled('password') ? Hash::make($request->string('password')->toString()) : null,
        ], fn (mixed $value): bool => $value !== null));

        return $this->success(new UserResource($user->load(['roles', 'employeeProfile.store'])), 'User updated successfully');
    }

    public function destroy(User $user): JsonResponse
    {
        if ($user->employeeProfile()->whereHas('shifts')->exists()
            || $user->employeeProfile()->whereHas('payrollLines')->exists()) {
            return $this->error('El trabajador tiene historial de asistencia o planilla; cámbialo a estado inactivo.', 409);
        }

        $user->delete();

        return $this->noContent();
    }
}
