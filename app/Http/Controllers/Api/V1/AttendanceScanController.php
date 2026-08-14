<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Attendance\ScanAttendanceQrAction;
use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\ScanAttendanceRequest;
use App\Http\Resources\AttendanceShiftResource;
use App\Models\AttendanceShift;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AttendanceScanController extends ApiController
{
    public function store(ScanAttendanceRequest $request, ScanAttendanceQrAction $action): JsonResponse
    {
        $user = $request->user();
        assert($user !== null);
        $result = $action->execute($user, $request->qrPayload(), [
            'device_id' => $request->deviceId(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);
        $result['shift']->load('store');

        return $this->created([
            'action' => $result['action'],
            'shift' => new AttendanceShiftResource($result['shift']),
        ], $result['action'] === 'entry' ? 'Entrada registrada' : 'Salida registrada');
    }

    public function status(Request $request): JsonResponse
    {
        $profile = $request->user()?->employeeProfile;
        $shift = $profile?->shifts()->with('store')->where('status', AttendanceShift::STATUS_OPEN)->latest('clocked_in_at')->first();

        return $this->success([
            'employee_profile_id' => $profile?->id,
            'employment_status' => $profile?->employment_status,
            'current_shift' => $shift ? new AttendanceShiftResource($shift) : null,
        ]);
    }

    public function history(Request $request): JsonResponse
    {
        $profile = $request->user()?->employeeProfile;
        if (! $profile) {
            return $this->success([]);
        }

        $shifts = $profile->shifts()->with('store')
            ->when($request->filled('from'), fn ($query) => $query->whereDate('clocked_in_at', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($query) => $query->whereDate('clocked_in_at', '<=', $request->date('to')))
            ->latest('clocked_in_at')->get();

        return $this->success(AttendanceShiftResource::collection($shifts));
    }
}
