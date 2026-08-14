<?php

declare(strict_types=1);

namespace App\Actions\Attendance;

use App\Exceptions\PayrollException;
use App\Models\AttendanceShift;
use App\Models\PayrollPeriod;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class AdjustAttendanceShiftAction
{
    public function execute(
        AttendanceShift $shift,
        string $clockedInAt,
        ?string $clockedOutAt,
        string $reason,
        ?int $adjustedBy,
    ): AttendanceShift {
        return DB::transaction(function () use ($shift, $clockedInAt, $clockedOutAt, $reason, $adjustedBy): AttendanceShift {
            $locked = AttendanceShift::query()->lockForUpdate()->findOrFail($shift->id);
            $newIn = CarbonImmutable::parse($clockedInAt)->utc();
            $newOut = $clockedOutAt ? CarbonImmutable::parse($clockedOutAt)->utc() : null;
            $timezone = config('payroll.timezone');
            assert(is_string($timezone));
            $localDate = $newIn->setTimezone($timezone)->toDateString();
            $previousLocalDate = $locked->clocked_in_at->setTimezone($timezone)->toDateString();
            if (PayrollPeriod::query()->where('status', PayrollPeriod::STATUS_CLOSED)
                ->where(function ($query) use ($localDate, $previousLocalDate): void {
                    $query->where(fn ($period) => $period->whereDate('starts_on', '<=', $localDate)->whereDate('ends_on', '>=', $localDate))
                        ->orWhere(fn ($period) => $period->whereDate('starts_on', '<=', $previousLocalDate)->whereDate('ends_on', '>=', $previousLocalDate));
                })->exists()) {
                throw PayrollException::closedPeriod();
            }
            $overlaps = AttendanceShift::query()
                ->where('employee_profile_id', $locked->employee_profile_id)
                ->whereKeyNot($locked->id)
                ->where('clocked_in_at', '<=', $newOut ?? $newIn)
                ->where(fn ($query) => $query->whereNull('clocked_out_at')->orWhere('clocked_out_at', '>=', $newIn))
                ->exists();
            if ($overlaps) {
                throw PayrollException::overlappingShift();
            }

            $locked->adjustments()->create([
                'adjusted_by' => $adjustedBy,
                'previous_clocked_in_at' => $locked->clocked_in_at,
                'previous_clocked_out_at' => $locked->clocked_out_at,
                'new_clocked_in_at' => $newIn,
                'new_clocked_out_at' => $newOut,
                'reason' => $reason,
            ]);

            $minutes = $newOut ? max(0, $newIn->diffInMinutes($newOut)) : null;
            $locked->update([
                'clocked_in_at' => $newIn,
                'clocked_out_at' => $newOut,
                'worked_minutes' => $minutes,
                'status' => $newOut ? AttendanceShift::STATUS_COMPLETED : AttendanceShift::STATUS_OPEN,
                'source' => 'manual',
            ]);

            return $locked->fresh() ?? $locked;
        });
    }
}
