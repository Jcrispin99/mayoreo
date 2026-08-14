<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\SaveEmployeeProfileRequest;
use App\Http\Resources\EmployeeProfileResource;
use App\Models\EmployeeProfile;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class EmployeeProfileController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $relations = ['user.roles', 'store', 'currentShift.store'];
        if ($request->user()?->can('payroll.view')) {
            $relations[] = 'compensations';
        }
        $employees = EmployeeProfile::query()
            ->with($relations)
            ->when($request->filled('store_id'), fn ($query) => $query->where('store_id', $request->integer('store_id')))
            ->when($request->filled('employment_status'), fn ($query) => $query->where('employment_status', $request->string('employment_status')->toString()))
            ->when($request->filled('query'), function ($query) use ($request): void {
                $search = '%'.$request->string('query')->toString().'%';
                $query->whereHas('user', fn ($userQuery) => $userQuery->where('name', 'like', $search)->orWhere('email', 'like', $search));
            })
            ->orderBy(User::select('name')->whereColumn('users.id', 'employee_profiles.user_id'))
            ->get();

        return $this->success(EmployeeProfileResource::collection($employees));
    }

    public function show(Request $request, EmployeeProfile $employeeProfile): JsonResponse
    {
        return $this->success(new EmployeeProfileResource($this->loadRelations(
            $employeeProfile,
            (bool) $request->user()?->can('payroll.view'),
        )));
    }

    public function update(SaveEmployeeProfileRequest $request, User $user): JsonResponse
    {
        $profile = $user->employeeProfile()->updateOrCreate([], $request->validated());

        return $this->success(
            new EmployeeProfileResource($this->loadRelations(
                $profile,
                (bool) $request->user()?->can('payroll.view'),
            )),
            'Perfil laboral guardado',
        );
    }

    private function loadRelations(EmployeeProfile $profile, bool $includeCompensations): EmployeeProfile
    {
        $relations = ['user.roles', 'store', 'currentShift.store'];
        if ($includeCompensations) {
            $relations[] = 'compensations.creator';
        }

        return $profile->load($relations);
    }
}
