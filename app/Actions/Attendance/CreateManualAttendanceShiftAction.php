<?php

declare(strict_types=1);

namespace App\Actions\Attendance;

use App\Exceptions\PayrollException;
use App\Models\AttendanceShift;
use App\Models\EmployeeProfile;
use App\Models\PayrollPeriod;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class CreateManualAttendanceShiftAction
{
    public function execute(
        EmployeeProfile $employee,
        int $storeId,
        string $clockedInAt,
        ?string $clockedOutAt,
        string $reason,
        ?int $createdBy,
    ): AttendanceShift {
        return DB::transaction(function () use ($employee, $storeId, $clockedInAt, $clockedOutAt, $reason, $createdBy): AttendanceShift {
            $lockedEmployee = EmployeeProfile::query()->lockForUpdate()->findOrFail($employee->id);
            $clockIn = CarbonImmutable::parse($clockedInAt)->utc();
            $clockOut = $clockedOutAt ? CarbonImmutable::parse($clockedOutAt)->utc() : null;
            $timezone = config('payroll.timezone');
            assert(is_string($timezone));
            $localDate = $clockIn->setTimezone($timezone)->toDateString();
            if (PayrollPeriod::query()->where('status', PayrollPeriod::STATUS_CLOSED)
                ->whereDate('starts_on', '<=', $localDate)->whereDate('ends_on', '>=', $localDate)->exists()) {
                throw PayrollException::closedPeriod();
            }

            $overlaps = $lockedEmployee->shifts()
                ->where('clocked_in_at', '<=', $clockOut ?? $clockIn)
                ->where(fn ($query) => $query->whereNull('clocked_out_at')->orWhere('clocked_out_at', '>=', $clockIn))
                ->exists();
            if ($overlaps) {
                throw PayrollException::overlappingShift();
            }

            $shift = AttendanceShift::query()->create([
                'employee_profile_id' => $lockedEmployee->id,
                'store_id' => $storeId,
                'clocked_in_at' => $clockIn,
                'clocked_out_at' => $clockOut,
                'worked_minutes' => $clockOut ? max(0, $clockIn->diffInMinutes($clockOut)) : null,
                'status' => $clockOut ? AttendanceShift::STATUS_COMPLETED : AttendanceShift::STATUS_OPEN,
                'source' => 'manual',
            ]);

            $shift->adjustments()->create([
                'adjusted_by' => $createdBy,
                'previous_clocked_in_at' => $clockIn,
                'previous_clocked_out_at' => null,
                'new_clocked_in_at' => $clockIn,
                'new_clocked_out_at' => $clockOut,
                'reason' => $reason,
            ]);

            return $shift;
        });
    }
}
