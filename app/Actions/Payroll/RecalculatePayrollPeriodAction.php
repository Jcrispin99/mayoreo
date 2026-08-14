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
     * @return array{
     *   pay_type: string, rate_amount: numeric-string, monthly_divisor: int|null,
     *   scheduled_days: int, valid_days: int, absence_days: int, incident_days: int,
     *   worked_minutes: int, base_amount: numeric-string, attendance_deduction: numeric-string,
     *   special_day_bonus: numeric-string, worked_day_equivalents: numeric-string,
     *   special_day_minutes: int, special_day_details: array<int, mixed>, calculated_amount: numeric-string
     * }
     */
    private function calculateEmployee(EmployeeProfile $employee, PayrollPeriod $period, Collection $specialDays): array
    {
        $timezone = config('payroll.timezone');
        assert(is_string($timezone));
        $periodStart = CarbonImmutable::parse($period->starts_on->toDateString(), $timezone);
        $periodEnd = CarbonImmutable::parse($period->ends_on->toDateString(), $timezone);
        $eligibleStart = $periodStart->max(CarbonImmutable::parse($employee->hired_at->toDateString(), $timezone));
        $eligibleEnd = $employee->terminated_at
            ? $periodEnd->min(CarbonImmutable::parse($employee->terminated_at->toDateString(), $timezone))
            : $periodEnd;

        $workDays = array_map('intval', $employee->work_days ?? []);
        $scheduledDateValues = [];
        foreach (CarbonPeriod::create($eligibleStart, $eligibleEnd) as $date) {
            assert($date instanceof DateTimeInterface);
            $immutableDate = CarbonImmutable::instance($date);
            if (in_array($immutableDate->dayOfWeek, $workDays, true)) {
                $scheduledDateValues[] = $immutableDate->toDateString();
            }
        }
        /** @var Collection<int, string> $scheduledDates */
        $scheduledDates = collect($scheduledDateValues);

        $fromUtc = $periodStart->startOfDay()->utc();
        $toUtc = $periodEnd->endOfDay()->utc();
        $shifts = $employee->shifts()->whereBetween('clocked_in_at', [$fromUtc, $toUtc])->get();
        $validShifts = $shifts->where('status', AttendanceShift::STATUS_COMPLETED)
            ->filter(fn (AttendanceShift $shift) => $shift->clocked_out_at !== null);
        $workedMinutesByDate = [];
        foreach ($validShifts as $validShift) {
            $date = $validShift->clocked_in_at->setTimezone($timezone)->toDateString();
            $workedMinutesByDate[$date] = ($workedMinutesByDate[$date] ?? 0) + ($validShift->worked_minutes ?? 0);
        }
        $incidentDates = $shifts->whereIn('status', [AttendanceShift::STATUS_OPEN, AttendanceShift::STATUS_INCIDENT])
            ->map(fn (AttendanceShift $shift) => $shift->clocked_in_at->setTimezone($timezone)->toDateString())
            ->toBase()
            ->intersect($scheduledDates)->unique()->values();

        $firstRateDate = $eligibleStart->toDateString();
        $firstRate = $this->rateAt($employee->compensations, $firstRateDate);
        if (! $firstRate) {
            throw PayrollException::missingCompensation($employee->user->name, $firstRateDate);
        }

        $workedMinutes = 0;
        foreach ($validShifts as $validShift) {
            $workedMinutes += $validShift->worked_minutes ?? 0;
        }

        $calendarDays = $periodStart->daysInMonth;
        $expectedMinutes = max(1, $employee->expected_minutes_per_day);
        $dailyMonthlyAmount = bcdiv((string) $firstRate->amount, (string) $calendarDays, 8);
        $outsideEmploymentDays = $this->outsideEmploymentDays($employee, $periodStart, $periodEnd);
        $eligibleCalendarDays = max(0, $calendarDays - $outsideEmploymentDays);
        $baseAmountRaw = $firstRate->pay_type === EmployeeCompensation::TYPE_MONTHLY
            ? bcmul($dailyMonthlyAmount, (string) $eligibleCalendarDays, 8)
            : '0.00000000';
        $attendanceDeductionRaw = '0.00000000';
        $specialBonusRaw = '0.00000000';
        $workedDayEquivalents = '0.00000000';
        $specialDayMinutes = 0;
        $specialDayDetails = [];
        $validDays = 0;
        $absenceDays = 0;

        foreach ($scheduledDates as $date) {
            $creditedMinutes = min($expectedMinutes, $workedMinutesByDate[$date] ?? 0);
            $workedRatio = bcdiv((string) $creditedMinutes, (string) $expectedMinutes, 8);
            $missingRatio = bcsub('1.00000000', $workedRatio, 8);
            $workedDayEquivalents = bcadd($workedDayEquivalents, $workedRatio, 8);
            if ($creditedMinutes === 0) {
                $absenceDays++;
            }
            if ($creditedMinutes >= $expectedMinutes) {
                $validDays++;
            }

            $rate = $this->rateAt($employee->compensations, $date);
            if (! $rate) {
                throw PayrollException::missingCompensation($employee->user->name, $date);
            }
            $dayAmount = $rate->pay_type === EmployeeCompensation::TYPE_MONTHLY
                ? bcdiv((string) $rate->amount, (string) $calendarDays, 8)
                : (string) $rate->amount;

            if ($firstRate->pay_type === EmployeeCompensation::TYPE_MONTHLY) {
                $attendanceDeductionRaw = bcadd(
                    $attendanceDeductionRaw,
                    bcmul($dayAmount, $missingRatio, 8),
                    8,
                );
            } else {
                $baseAmountRaw = bcadd($baseAmountRaw, bcmul($dayAmount, $workedRatio, 8), 8);
            }

            $specialDay = $specialDays->get($date);
            if ($specialDay instanceof SpecialDay && $creditedMinutes > 0) {
                $bonusRate = bcdiv((string) $specialDay->bonus_percentage, '100', 8);
                $bonus = bcmul(bcmul($dayAmount, $bonusRate, 8), $workedRatio, 8);
                $specialBonusRaw = bcadd($specialBonusRaw, $bonus, 8);
                $specialDayMinutes += $creditedMinutes;
                $specialDayDetails[] = [
                    'date' => $date,
                    'name' => $specialDay->name,
                    'bonus_percentage' => $specialDay->bonus_percentage,
                    'worked_minutes' => $creditedMinutes,
                    'expected_minutes' => $expectedMinutes,
                    'amount' => $this->money($bonus),
                ];
            }
        }

        if ($firstRate->pay_type === EmployeeCompensation::TYPE_MONTHLY) {
            $afterDeduction = bccomp($baseAmountRaw, $attendanceDeductionRaw, 8) === 1
                ? bcsub($baseAmountRaw, $attendanceDeductionRaw, 8)
                : '0.00000000';
            $calculatedRaw = bcadd($afterDeduction, $specialBonusRaw, 8);
        } else {
            $calculatedRaw = bcadd($baseAmountRaw, $specialBonusRaw, 8);
        }

        return [
            'pay_type' => $firstRate->pay_type,
            'rate_amount' => $firstRate->amount,
            'monthly_divisor' => $firstRate->pay_type === EmployeeCompensation::TYPE_MONTHLY ? $calendarDays : null,
            'scheduled_days' => $scheduledDates->count(),
            'valid_days' => $validDays,
            'absence_days' => $absenceDays,
            'incident_days' => $incidentDates->count(),
            'worked_minutes' => $workedMinutes,
            'base_amount' => $this->money($baseAmountRaw),
            'attendance_deduction' => $this->money($attendanceDeductionRaw),
            'special_day_bonus' => $this->money($specialBonusRaw),
            'worked_day_equivalents' => number_format((float) $workedDayEquivalents, 4, '.', ''),
            'special_day_minutes' => $specialDayMinutes,
            'special_day_details' => $specialDayDetails,
            'calculated_amount' => $this->money($calculatedRaw),
        ];
    }

    /** @return numeric-string */
    private function money(string $value): string
    {
        return $this->moneyService->roundHalfUp($value);
    }

    /** @param Collection<int, EmployeeCompensation> $rates */
    private function rateAt(Collection $rates, string $date): ?EmployeeCompensation
    {
        return $rates->first(fn (EmployeeCompensation $rate) => $rate->effective_from->toDateString() <= $date
            && ($rate->effective_to === null || $rate->effective_to->toDateString() >= $date));
    }

    private function outsideEmploymentDays(EmployeeProfile $employee, CarbonImmutable $start, CarbonImmutable $end): int
    {
        $days = 0;
        foreach (CarbonPeriod::create($start, $end) as $date) {
            assert($date instanceof DateTimeInterface);
            $day = CarbonImmutable::instance($date)->toDateString();
            if ($day < $employee->hired_at->toDateString()
                || ($employee->terminated_at && $day > $employee->terminated_at->toDateString())) {
                $days++;
            }
        }

        return $days;
    }
}
