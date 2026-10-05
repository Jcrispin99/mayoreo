<?php

declare(strict_types=1);

namespace App\Actions\Attendance;

use App\Exceptions\PayrollException;
use App\Models\AttendanceEvent;
use App\Models\AttendanceShift;
use App\Models\EmployeeProfile;
use App\Models\PayrollPeriod;
use App\Models\Store;
use App\Models\User;
use App\Services\AttendanceQrPayloadService;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class ScanAttendanceQrAction
{
    public function __construct(private AttendanceQrPayloadService $payloadService) {}

    /** @param array<string, mixed> $metadata
     * @return array{action: 'entry'|'exit', shift: AttendanceShift}
     */
    public function execute(User $user, string $payload, array $metadata = []): array
    {
        $qr = $this->payloadService->resolve($payload);
        $metadata = [...$metadata, ...$this->validateLocation($qr->store, $metadata)];

        return DB::transaction(function () use ($user, $qr, $metadata): array {
            $now = now()->toImmutable()->utc();
            $timezone = config('payroll.timezone');
            $cooldownSeconds = config('payroll.scan_cooldown_seconds');
            $maximumShiftMinutes = config('payroll.maximum_shift_minutes');
            $attendanceDayStartsAt = config('payroll.attendance_day_starts_at');
            assert(is_string($timezone));
            assert(is_int($cooldownSeconds));
            assert(is_int($maximumShiftMinutes));
            assert(is_string($attendanceDayStartsAt));
            $today = $now->setTimezone($timezone)->toDateString();
            $employee = EmployeeProfile::query()->where('user_id', $user->id)->lockForUpdate()->first();

            if (! $employee || $employee->employment_status !== EmployeeProfile::STATUS_ACTIVE
                || $employee->hired_at->toDateString() > $today
                || ($employee->terminated_at && $employee->terminated_at->toDateString() < $today)) {
                throw PayrollException::employeeInactive();
            }
            if (PayrollPeriod::query()->where('status', PayrollPeriod::STATUS_CLOSED)
                ->whereDate('starts_on', '<=', $today)->whereDate('ends_on', '>=', $today)
                ->whereHas('lines', fn ($query) => $query->where('employee_profile_id', $employee->id))
                ->exists()) {
                throw PayrollException::closedPeriod();
            }

            if ($employee->store_id !== null && $employee->store_id !== $qr->store_id) {
                throw PayrollException::wrongAssignedStore();
            }

            $lastEvent = AttendanceEvent::query()->where('employee_profile_id', $employee->id)
                ->orderByDesc('occurred_at')->lockForUpdate()->first();
            if ($lastEvent && $lastEvent->occurred_at->greaterThan($now->subSeconds($cooldownSeconds))) {
                throw PayrollException::duplicateScan();
            }

            $openShift = AttendanceShift::query()
                ->where('employee_profile_id', $employee->id)
                ->where('status', AttendanceShift::STATUS_OPEN)
                ->lockForUpdate()->first();

            if ($openShift && $this->hasPassedAttendanceDayCutoff($openShift, $now, $timezone, $attendanceDayStartsAt)) {
                $openShift->update([
                    'status' => AttendanceShift::STATUS_INCIDENT,
                ]);
                $openShift = null;
            }

            if ($openShift) {
                if ($openShift->store_id !== $qr->store_id) {
                    throw PayrollException::differentExitStore();
                }

                $minutes = max(0, $openShift->clocked_in_at->diffInMinutes($now));
                $openShift->update([
                    'clocked_out_at' => $now,
                    'worked_minutes' => $minutes,
                    'status' => $minutes > $maximumShiftMinutes
                        ? AttendanceShift::STATUS_INCIDENT
                        : AttendanceShift::STATUS_COMPLETED,
                ]);
                $this->recordEvent($openShift, 'exit', $now, $user->id, $metadata);

                return ['action' => 'exit', 'shift' => $openShift->fresh() ?? $openShift];
            }

            $shift = AttendanceShift::query()->create([
                'employee_profile_id' => $employee->id,
                'store_id' => $qr->store_id,
                'clocked_in_at' => $now,
                'status' => AttendanceShift::STATUS_OPEN,
                'source' => 'qr',
            ]);
            $this->recordEvent($shift, 'entry', $now, $user->id, $metadata);

            return ['action' => 'entry', 'shift' => $shift];
        });
    }

    /**
     * @param  array<string, mixed>  $metadata
     * @return array{distance_meters: float, attendance_location_id?: int, attendance_location_name?: string}
     */
    private function validateLocation(Store $store, array $metadata): array
    {
        $latitude = $metadata['latitude'] ?? null;
        $longitude = $metadata['longitude'] ?? null;
        $accuracy = $metadata['accuracy'] ?? null;
        if (! is_numeric($latitude) || ! is_numeric($longitude) || ! is_numeric($accuracy)) {
            throw PayrollException::inaccurateLocation();
        }

        $maximumAccuracy = config('payroll.maximum_location_accuracy_meters');
        assert(is_int($maximumAccuracy));
        if ((float) $accuracy > $maximumAccuracy) {
            throw PayrollException::inaccurateLocation();
        }

        $locations = $store->attendanceLocations()
            ->where('is_active', true)
            ->orderBy('id')
            ->get();

        foreach ($locations as $location) {
            $distance = $this->distanceMeters(
                (float) $latitude,
                (float) $longitude,
                (float) $location->latitude,
                (float) $location->longitude,
            );

            if ($distance <= $location->radius_meters) {
                return [
                    'distance_meters' => round($distance, 2),
                    'attendance_location_id' => $location->id,
                    'attendance_location_name' => $location->name,
                ];
            }
        }

        if ($locations->isNotEmpty()) {
            throw PayrollException::outsideAttendanceArea();
        }

        if ($store->attendance_latitude === null || $store->attendance_longitude === null) {
            throw PayrollException::storeLocationMissing();
        }

        $distance = $this->distanceMeters(
            (float) $latitude,
            (float) $longitude,
            (float) $store->attendance_latitude,
            (float) $store->attendance_longitude,
        );

        if ($distance > $store->attendance_radius_meters) {
            throw PayrollException::outsideAttendanceArea();
        }

        return ['distance_meters' => round($distance, 2)];
    }

    private function distanceMeters(
        float $latitude,
        float $longitude,
        float $authorizedLatitude,
        float $authorizedLongitude,
    ): float {
        $earthRadius = 6371000.0;
        $authorizedLatitudeRadians = deg2rad($authorizedLatitude);
        $latitudeRadians = deg2rad($latitude);
        $latitudeDelta = $latitudeRadians - $authorizedLatitudeRadians;
        $longitudeDelta = deg2rad($longitude - $authorizedLongitude);
        $haversine = sin($latitudeDelta / 2) ** 2
            + cos($authorizedLatitudeRadians) * cos($latitudeRadians) * sin($longitudeDelta / 2) ** 2;

        return 2 * $earthRadius * asin(min(1.0, sqrt($haversine)));
    }

    /** @param array<string, mixed> $metadata */
    private function recordEvent(AttendanceShift $shift, string $type, CarbonImmutable $occurredAt, int $userId, array $metadata): void
    {
        $shift->events()->create([
            'employee_profile_id' => $shift->employee_profile_id,
            'store_id' => $shift->store_id,
            'type' => $type,
            'occurred_at' => $occurredAt,
            'source' => 'qr',
            'recorded_by' => $userId,
            'metadata' => $metadata,
        ]);
    }

    private function hasPassedAttendanceDayCutoff(
        AttendanceShift $shift,
        CarbonImmutable $now,
        string $timezone,
        string $attendanceDayStartsAt,
    ): bool {
        $rawClockedInAt = $shift->getRawOriginal('clocked_in_at');
        assert(is_string($rawClockedInAt));
        $clockedInAt = CarbonImmutable::parse($rawClockedInAt, 'UTC');
        $localClockedInAt = $clockedInAt->setTimezone($timezone);
        $cutoff = $localClockedInAt
            ->startOfDay()
            ->setTimeFromTimeString($attendanceDayStartsAt);
        if ($localClockedInAt->greaterThanOrEqualTo($cutoff)) {
            $cutoff = $cutoff->addDay();
        }

        return $now->greaterThanOrEqualTo($cutoff->utc());
    }
}
