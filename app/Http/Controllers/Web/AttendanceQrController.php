<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Actions\Attendance\RotateStoreAttendanceQrAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Web\UpdateAttendanceLocationRequest;
use App\Models\Store;
use App\Services\AttendanceQrPayloadService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class AttendanceQrController extends Controller
{
    public function index(AttendanceQrPayloadService $payloadService): Response
    {
        $stores = Store::query()
            ->with('attendanceQrToken')
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        return Inertia::render('attendance-qr/index', [
            'stores' => $stores->map(function (Store $store) use ($payloadService): array {
                $token = $store->attendanceQrToken;
                $recoverable = is_string($token?->encrypted_token) && $token->encrypted_token !== '';

                return [
                    'id' => $store->id,
                    'code' => $store->code,
                    'name' => $store->name,
                    'address' => $store->address,
                    'attendance_latitude' => $store->attendance_latitude,
                    'attendance_longitude' => $store->attendance_longitude,
                    'attendance_radius_meters' => $store->attendance_radius_meters,
                    'configured' => $token !== null,
                    'recoverable' => $recoverable,
                    'payload' => $recoverable ? $payloadService->issue($token)['payload'] : null,
                    'rotated_at' => $token?->rotated_at?->toIso8601String(),
                ];
            }),
        ]);
    }

    public function rotate(
        Request $request,
        Store $store,
        RotateStoreAttendanceQrAction $action,
    ): RedirectResponse {
        abort_unless($store->is_active, 404);

        $action->execute($store, $request->user()?->id);

        return back();
    }

    public function updateLocation(UpdateAttendanceLocationRequest $request, Store $store): RedirectResponse
    {
        abort_unless($store->is_active, 404);

        $store->update($request->validated());

        return back();
    }
}
