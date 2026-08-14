<?php

declare(strict_types=1);

namespace App\Actions\Attendance;

use App\Exceptions\PayrollException;
use App\Models\AttendanceEvent;
use App\Models\AttendanceShift;
use App\Models\EmployeeProfile;
use App\Models\PayrollPeriod;
use App\Models\StoreAttendanceQrToken;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class ScanAttendanceQrAction
{
    /** @param array<string, mixed> $metadata
     * @return array{action: 'entry'|'exit', shift: AttendanceShift}
     */
    public function execute(User $user, string $payload, array $metadata = []): array
    {
        $prefix = config('payroll.qr_prefix');
        assert(is_string($prefix));
        if (! str_starts_with($payload, $prefix)) {
            throw PayrollException::invalidQr();
        }

        $rawToken = mb_substr($payload, mb_strlen($prefix));
        $qr = StoreAttendanceQrToken::query()->with('store')
            ->where('token_hash', hash('sha256', $rawToken))->first();
        if (! $qr || ! $qr->store->is_active) {
            throw PayrollException::invalidQr();
        }

        return DB::transaction(function () use ($user, $qr, $metadata): array {
            $now = now()->toImmutable()->utc();
            $timezone = config('payroll.timezone');
            $cooldownSeconds = config('payroll.scan_cooldown_seconds');
            $maximumShiftMinutes = config('payroll.maximum_shift_minutes');
            assert(is_string($timezone));
            assert(is_int($cooldownSeconds));
            assert(is_int($maximumShiftMinutes));
            $today = $now->setTimezone($timezone)->toDateString();
            if (PayrollPeriod::query()->where('status', PayrollPeriod::STATUS_CLOSED)
                ->whereDate('starts_on', '<=', $today)->whereDate('ends_on', '>=', $today)->exists()) {
                throw PayrollException::closedPeriod();
            }
            $employee = EmployeeProfile::query()->where('user_id', $user->id)->lockForUpdate()->first();

            if (! $employee || $employee->employment_status !== EmployeeProfile::STATUS_ACTIVE
                || $employee->hired_at->toDateString() > $today
                || ($employee->terminated_at && $employee->terminated_at->toDateString() < $today)) {
                throw PayrollException::employeeInactive();
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
}
