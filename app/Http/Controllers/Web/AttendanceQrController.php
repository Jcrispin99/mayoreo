<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Actions\Attendance\RotateStoreAttendanceQrAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Web\SaveAttendanceLocationRequest;
use App\Http\Requests\Web\UpdateAttendanceLocationRequest;
use App\Models\AttendanceLocation;
use App\Models\Store;
use App\Services\AttendanceQrPayloadService;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

final class AttendanceQrController extends Controller
{
    public function index(AttendanceQrPayloadService $payloadService): Response
    {
        $stores = Store::query()
            ->with([
                'attendanceQrToken',
                'attendanceLocations' => function (Relation $relation): void {
                    $relation->getQuery()->orderByDesc('is_active')->orderBy('name');
                },
            ])
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
                    'attendance_locations' => $store->attendanceLocations->map(fn (AttendanceLocation $location): array => [
                        'id' => $location->id,
                        'name' => $location->name,
                        'latitude' => $location->latitude,
                        'longitude' => $location->longitude,
                        'radius_meters' => $location->radius_meters,
                        'is_active' => $location->is_active,
                    ])->values(),
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

        DB::transaction(function () use ($request, $store): void {
            $values = $request->validated();
            $location = $store->attendanceLocations()->oldest('id')->first();
            $attributes = [
                'name' => $location instanceof AttendanceLocation ? $location->name : 'Ubicación principal',
                'latitude' => $values['attendance_latitude'],
                'longitude' => $values['attendance_longitude'],
                'radius_meters' => $values['attendance_radius_meters'],
                'is_active' => true,
            ];

            if ($location instanceof AttendanceLocation) {
                $location->update($attributes);
            } else {
                $store->attendanceLocations()->create($attributes);
            }

            $store->update($values);
        });

        return back();
    }

    public function storeAttendanceLocation(
        SaveAttendanceLocationRequest $request,
        Store $store,
    ): RedirectResponse {
        abort_unless($store->is_active, 404);

        DB::transaction(function () use ($request, $store): void {
            $store->attendanceLocations()->create($request->validated());
            $this->syncLegacyAttendanceLocation($store);
        });

        return back();
    }

    public function updateAttendanceLocation(
        SaveAttendanceLocationRequest $request,
        Store $store,
        AttendanceLocation $attendanceLocation,
    ): RedirectResponse {
        abort_unless($store->is_active && $attendanceLocation->store_id === $store->id, 404);

        DB::transaction(function () use ($request, $store, $attendanceLocation): void {
            $attendanceLocation->update($request->validated());
            $this->syncLegacyAttendanceLocation($store);
        });

        return back();
    }

    public function destroyAttendanceLocation(
        Store $store,
        AttendanceLocation $attendanceLocation,
    ): RedirectResponse {
        abort_unless($store->is_active && $attendanceLocation->store_id === $store->id, 404);

        DB::transaction(function () use ($store, $attendanceLocation): void {
            $attendanceLocation->delete();
            $this->syncLegacyAttendanceLocation($store);
        });

        return back();
    }

    private function syncLegacyAttendanceLocation(Store $store): void
    {
        $location = $store->attendanceLocations()
            ->where('is_active', true)
            ->oldest('id')
            ->first();

        $store->update($location instanceof AttendanceLocation ? [
            'attendance_latitude' => $location->latitude,
            'attendance_longitude' => $location->longitude,
            'attendance_radius_meters' => $location->radius_meters,
        ] : [
            'attendance_latitude' => null,
            'attendance_longitude' => null,
            'attendance_radius_meters' => 100,
        ]);
    }
}
