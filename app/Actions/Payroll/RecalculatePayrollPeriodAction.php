<?php

declare(strict_types=1);

namespace App\Actions\Payroll;

use App\Exceptions\PayrollException;
use App\Models\AttendanceShift;
use App\Models\EmployeeCompensation;
use App\Models\EmployeeProfile;
use App\Models\PayrollPeriod;
use App\Models\SpecialDay;
use App\Services\MoneyService;
use Carbon\CarbonImmutable;
use Carbon\CarbonPeriod;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final readonly class RecalculatePayrollPeriodAction
{
    public function __construct(private MoneyService $moneyService) {}

    public function execute(PayrollPeriod $period): PayrollPeriod
    {
        if ($period->status === PayrollPeriod::STATUS_CLOSED) {
            throw PayrollException::closedPeriod();
        }

        return DB::transaction(function () use ($period): PayrollPeriod {
            $locked = PayrollPeriod::query()->lockForUpdate()->findOrFail($period->id);
            if ($locked->status === PayrollPeriod::STATUS_CLOSED) {
                throw PayrollException::closedPeriod();
            }

            $profiles = EmployeeProfile::query()
                ->with(['user', 'compensations'])
                ->whereDate('hired_at', '<=', $locked->ends_on)
                ->where(fn ($query) => $query->whereNull('terminated_at')->orWhereDate('terminated_at', '>=', $locked->starts_on))
                ->get();
            $specialDays = SpecialDay::query()
                ->where('is_active', true)
                ->whereBetween('date', [$locked->starts_on, $locked->ends_on])
                ->get()
                ->keyBy(fn (SpecialDay $day) => $day->date->toDateString());

            foreach ($profiles as $employee) {
                $values = $this->calculateEmployee($employee, $locked, $specialDays);
                if ($values === null) {
                    $locked->lines()->where('employee_profile_id', $employee->id)->delete();

                    continue;
                }
                $existing = $locked->lines()->where('employee_profile_id', $employee->id)->first();
                $adjustment = '0.00';
                $notes = null;
                if ($existing instanceof \App\Models\PayrollLine) {
                    $adjustment = $existing->adjustments_amount;
                    $notes = $existing->notes;
                }
                $values['adjustments_amount'] = $adjustment;
                $values['payable_amount'] = bcadd($values['calculated_amount'], $adjustment, 2);
                $values['notes'] = $notes;
                $locked->lines()->updateOrCreate(['employee_profile_id' => $employee->id], $values);
            }

            $locked->lines()->whereNotIn('employee_profile_id', $profiles->pluck('id'))->delete();

            return $locked->fresh(['lines.employeeProfile.user', 'lines.employeeProfile.store']) ?? $locked;
        });
    }

    /**
     * @param  EloquentCollection<string, SpecialDay>  $specialDays
     * @return array{
     *   pay_type: string, rate_amount: numeric-string, monthly_divisor: int|null,
     *   scheduled_days: int, valid_days: int, absence_days: int, incident_days: int,
     *   worked_minutes: int, required_minutes: int, credited_minutes: int, completion_ratio: numeric-string,
     *   base_amount: numeric-string, attendance_deduction: numeric-string,
     *   special_day_bonus: numeric-string, worked_day_equivalents: numeric-string,
     *   special_day_minutes: int, special_day_details: array<int, mixed>, calculated_amount: numeric-string
     * }|null
     */
    private function calculateEmployee(EmployeeProfile $employee, PayrollPeriod $period, EloquentCollection $specialDays): ?array
    {
        $timezone = config('payroll.timezone');
        assert(is_string($timezone));
        $periodStart = CarbonImmutable::parse($period->starts_on->toDateString(), $timezone);
        $periodEnd = CarbonImmutable::parse($period->ends_on->toDateString(), $timezone);
        $eligibleStart = $periodStart->max(CarbonImmutable::parse($employee->hired_at->toDateString(), $timezone));
        $eligibleEnd = $employee->terminated_at
            ? $periodEnd->min(CarbonImmutable::parse($employee->terminated_at->toDateString(), $timezone))
            : $periodEnd;

        $baseAmountRaw = '0.00000000';
        $requiredMinutesRaw = '0.00000000';
        $eligibleDates = [];
        $firstRate = null;

        foreach (CarbonPeriod::create($eligibleStart, $eligibleEnd) as $date) {
            assert($date instanceof DateTimeInterface);
            $day = CarbonImmutable::instance($date);
            $dateValue = $day->toDateString();
            $rate = $this->rateAt($employee->compensations, $dateValue);
            if (! $rate) {
                throw PayrollException::missingCompensation($employee->user->name, $dateValue);
            }
            if (! in_array($rate->pay_type, [EmployeeCompensation::TYPE_MONTHLY, EmployeeCompensation::TYPE_WEEKLY], true)) {
                throw PayrollException::unsupportedCompensation($employee->user->name);
            }
            if ($rate->pay_type !== $period->pay_frequency) {
                continue;
            }

            $firstRate ??= $rate;
            $cycleDays = $rate->pay_type === EmployeeCompensation::TYPE_MONTHLY ? $day->daysInMonth : 7;
            $expectedMinutes = $this->expectedMinutes($rate, $employee, $day);
            $baseAmountRaw = bcadd($baseAmountRaw, bcdiv((string) $rate->amount, (string) $cycleDays, 8), 8);
            $requiredMinutesRaw = bcadd($requiredMinutesRaw, bcdiv((string) $expectedMinutes, (string) $cycleDays, 8), 8);
            $eligibleDates[$dateValue] = [
                'rate' => $rate,
                'expected_minutes' => $expectedMinutes,
                'minute_rate' => bcdiv((string) $rate->amount, (string) $expectedMinutes, 12),
            ];
        }

        if (! $firstRate instanceof EmployeeCompensation) {
            return null;
        }

        $periodStartAt = $periodStart->startOfDay();
        $periodEndExclusive = $periodEnd->addDay()->startOfDay();
        $fromUtc = $periodStartAt->utc();
        $toUtc = $periodEndExclusive->utc();
        $shifts = $employee->shifts()
            ->where('clocked_in_at', '<', $toUtc)
            ->where(function ($query) use ($fromUtc): void {
                $query->where('clocked_out_at', '>', $fromUtc)
                    ->orWhere(function ($openQuery) use ($fromUtc): void {
                        $openQuery->whereNull('clocked_out_at')->where('clocked_in_at', '>=', $fromUtc);
                    });
            })->get();
        $validShifts = $shifts->where('status', AttendanceShift::STATUS_COMPLETED)
            ->filter(fn (AttendanceShift $shift) => $shift->clocked_out_at !== null);
        $workedSecondsByDate = [];
        foreach ($validShifts as $validShift) {
            $rawClockedInAt = $validShift->getRawOriginal('clocked_in_at');
            $rawClockedOutAt = $validShift->getRawOriginal('clocked_out_at');
            assert(is_string($rawClockedInAt) && is_string($rawClockedOutAt));
            $shiftStart = CarbonImmutable::parse($rawClockedInAt, 'UTC')->setTimezone($timezone);
            $shiftEnd = CarbonImmutable::parse($rawClockedOutAt, 'UTC')->setTimezone($timezone);
            $cursor = $shiftStart->greaterThan($periodStartAt) ? $shiftStart : $periodStartAt;
            $end = $shiftEnd->lessThan($periodEndExclusive) ? $shiftEnd : $periodEndExclusive;
            while ($cursor->lessThan($end)) {
                $nextDay = $cursor->startOfDay()->addDay();
                $segmentEnd = $nextDay->lessThan($end) ? $nextDay : $end;
                $dateValue = $cursor->toDateString();
                if (array_key_exists($dateValue, $eligibleDates)) {
                    $seconds = max(0, $segmentEnd->getTimestamp() - $cursor->getTimestamp());
                    $workedSecondsByDate[$dateValue] = ($workedSecondsByDate[$dateValue] ?? 0) + $seconds;
                }
                $cursor = $segmentEnd;
            }
        }

        $workedSeconds = array_sum($workedSecondsByDate);
        $workedMinutes = intdiv($workedSeconds, 60);
        $requiredMinutes = max(1, (int) bcadd($requiredMinutesRaw, '0.5', 0));
        $creditedMinutes = min($workedMinutes, $requiredMinutes);
        $completionRatio = bcdiv((string) $creditedMinutes, (string) $requiredMinutes, 8);
        $earnedBaseRaw = bcmul($baseAmountRaw, $completionRatio, 8);
        $attendanceDeductionRaw = bcsub($baseAmountRaw, $earnedBaseRaw, 8);

        $workDays = array_map('intval', $employee->work_days ?? []);
        $scheduledDates = collect(array_keys($eligibleDates))->filter(
            fn (string $date): bool => in_array(CarbonImmutable::parse($date, $timezone)->dayOfWeek, $workDays, true),
        )->values();
        $validDays = $scheduledDates->filter(fn (string $date): bool => ($workedSecondsByDate[$date] ?? 0) > 0)->count();
        $absenceDays = $scheduledDates->count() - $validDays;
        $incidentDates = $shifts->whereIn('status', [AttendanceShift::STATUS_OPEN, AttendanceShift::STATUS_INCIDENT])
            ->map(function (AttendanceShift $shift) use ($timezone): string {
                $rawClockedInAt = $shift->getRawOriginal('clocked_in_at');
                assert(is_string($rawClockedInAt));

                return CarbonImmutable::parse($rawClockedInAt, 'UTC')->setTimezone($timezone)->toDateString();
            })
            ->filter(fn (string $date): bool => array_key_exists($date, $eligibleDates))
            ->unique()->values();

        $specialBonusRaw = '0.00000000';
        $specialDayMinutes = 0;
        $specialDayDetails = [];
        foreach ($workedSecondsByDate as $date => $seconds) {
            $specialDay = $specialDays->get($date);
            if (! $specialDay instanceof SpecialDay || $seconds <= 0) {
                continue;
            }
            $minutesRaw = bcdiv((string) $seconds, '60', 8);
            $bonusRate = bcdiv((string) $specialDay->bonus_percentage, '100', 8);
            $bonus = bcmul(bcmul($minutesRaw, $eligibleDates[$date]['minute_rate'], 8), $bonusRate, 8);
            $minutes = intdiv($seconds, 60);
            $specialBonusRaw = bcadd($specialBonusRaw, $bonus, 8);
            $specialDayMinutes += $minutes;
            $specialDayDetails[] = [
                'date' => $date,
                'name' => $specialDay->name,
                'bonus_percentage' => $specialDay->bonus_percentage,
                'worked_minutes' => $minutes,
                'expected_minutes' => $eligibleDates[$date]['expected_minutes'],
                'amount' => $this->money($bonus),
            ];
        }
        $calculatedRaw = bcadd($earnedBaseRaw, $specialBonusRaw, 8);

        return [
            'pay_type' => $firstRate->pay_type,
            'rate_amount' => $firstRate->amount,
            'monthly_divisor' => $firstRate->pay_type === EmployeeCompensation::TYPE_MONTHLY ? $periodStart->daysInMonth : null,
            'scheduled_days' => $scheduledDates->count(),
            'valid_days' => $validDays,
            'absence_days' => $absenceDays,
            'incident_days' => $incidentDates->count(),
            'worked_minutes' => $workedMinutes,
            'required_minutes' => $requiredMinutes,
            'credited_minutes' => $creditedMinutes,
            'completion_ratio' => number_format((float) $completionRatio, 6, '.', ''),
            'base_amount' => $this->money($baseAmountRaw),
            'attendance_deduction' => $this->money($attendanceDeductionRaw),
            'special_day_bonus' => $this->money($specialBonusRaw),
            'worked_day_equivalents' => number_format((float) $completionRatio, 4, '.', ''),
            'special_day_minutes' => $specialDayMinutes,
            'special_day_details' => $specialDayDetails,
            'calculated_amount' => $this->money($calculatedRaw),
        ];
    }

    /** @return numeric-string */
    private function money(string $value): string
    {
        /** @var numeric-string $value */
        return $this->moneyService->roundHalfUp($value);
    }

    /** @param Collection<int, EmployeeCompensation> $rates */
    private function rateAt(Collection $rates, string $date): ?EmployeeCompensation
    {
        return $rates->first(fn (EmployeeCompensation $rate) => $rate->effective_from->toDateString() <= $date
            && ($rate->effective_to === null || $rate->effective_to->toDateString() >= $date));
    }

    private function expectedMinutes(EmployeeCompensation $rate, EmployeeProfile $employee, CarbonImmutable $date): int
    {
        if ($rate->expected_minutes !== null && $rate->expected_minutes > 0) {
            return $rate->expected_minutes;
        }

        $cycleStart = $rate->pay_type === EmployeeCompensation::TYPE_MONTHLY
            ? $date->startOfMonth()
            : $date->startOfWeek();
        $cycleEnd = $rate->pay_type === EmployeeCompensation::TYPE_MONTHLY
            ? $date->endOfMonth()
            : $date->endOfWeek();
        $workDays = array_map('intval', $employee->work_days ?? []);
        $scheduledDays = 0;
        foreach (CarbonPeriod::create($cycleStart, $cycleEnd) as $cycleDate) {
            assert($cycleDate instanceof DateTimeInterface);
            if (in_array(CarbonImmutable::instance($cycleDate)->dayOfWeek, $workDays, true)) {
                $scheduledDays++;
            }
        }

        return max(1, $scheduledDays * max(1, $employee->expected_minutes_per_day));
    }
}
