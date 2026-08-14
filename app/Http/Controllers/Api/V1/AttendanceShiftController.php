<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Attendance\AdjustAttendanceShiftAction;
use App\Actions\Attendance\CreateManualAttendanceShiftAction;
use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\AdjustAttendanceShiftRequest;
use App\Http\Requests\Api\V1\StoreManualAttendanceShiftRequest;
use App\Http\Resources\AttendanceShiftResource;
use App\Models\AttendanceShift;
use App\Models\EmployeeProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AttendanceShiftController extends ApiController
{
    public function store(StoreManualAttendanceShiftRequest $request, CreateManualAttendanceShiftAction $action): JsonResponse
    {
        $employee = EmployeeProfile::query()->findOrFail($request->integer('employee_profile_id'));
        $shift = $action->execute(
            $employee,
            $request->integer('store_id'),
            $request->clockedInAt(),
            $request->clockedOutAt(),
            $request->reason(),
            $request->user()?->id,
        );

        return $this->created(new AttendanceShiftResource($this->loadRelations($shift)), 'Asistencia manual registrada');
    }

    public function index(Request $request): JsonResponse
    {
        $shifts = AttendanceShift::query()
            ->with(['employeeProfile.user.roles', 'employeeProfile.store', 'store', 'adjustments.adjuster'])
            ->when($request->filled('employee_profile_id'), fn ($query) => $query->where('employee_profile_id', $request->integer('employee_profile_id')))
            ->when($request->filled('store_id'), fn ($query) => $query->where('store_id', $request->integer('store_id')))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->toString()))
            ->when($request->filled('from'), fn ($query) => $query->where('clocked_in_at', '>=', $request->date('from')?->startOfDay()))
            ->when($request->filled('to'), fn ($query) => $query->where('clocked_in_at', '<=', $request->date('to')?->endOfDay()))
            ->latest('clocked_in_at')->get();

        return $this->success(AttendanceShiftResource::collection($shifts));
    }

    public function show(AttendanceShift $attendanceShift): JsonResponse
    {
        return $this->success(new AttendanceShiftResource($this->loadRelations($attendanceShift)));
    }

    public function update(
        AdjustAttendanceShiftRequest $request,
        AttendanceShift $attendanceShift,
        AdjustAttendanceShiftAction $action,
    ): JsonResponse {
        $shift = $action->execute(
            $attendanceShift,
            $request->clockedInAt(),
            $request->clockedOutAt(),
            $request->reason(),
            $request->user()?->id,
        );

        return $this->success(new AttendanceShiftResource($this->loadRelations($shift)), 'Asistencia corregida');
    }

    private function loadRelations(AttendanceShift $shift): AttendanceShift
    {
        return $shift->load(['employeeProfile.user.roles', 'employeeProfile.store', 'store', 'adjustments.adjuster']);
    }
}
