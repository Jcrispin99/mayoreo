<?php

declare(strict_types=1);

namespace App\Actions\Payroll;

use App\Exceptions\PayrollException;
use App\Models\EmployeeCompensation;
use App\Models\EmployeeProfile;
use App\Models\PayrollPeriod;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class SaveEmployeeCompensationAction
{
    /** @param numeric-string $amount */
    public function execute(
        EmployeeProfile $employee,
        string $payType,
        string $amount,
        int $expectedMinutes,
        string $effectiveFrom,
        ?int $createdBy,
        ?string $notes,
    ): EmployeeCompensation {
        return DB::transaction(function () use ($employee, $payType, $amount, $expectedMinutes, $effectiveFrom, $createdBy, $notes): EmployeeCompensation {
            $date = CarbonImmutable::parse($effectiveFrom)->startOfDay();
            $lockedEmployee = EmployeeProfile::query()->lockForUpdate()->findOrFail($employee->id);

            $hasEarlierCompensation = $lockedEmployee->compensations()
                ->whereDate('effective_from', '<', $date)->exists();
            if ($payType === EmployeeCompensation::TYPE_MONTHLY && $date->day !== 1 && $hasEarlierCompensation) {
                throw PayrollException::invalidMonthlyCompensationDate();
            }
            if ($payType === EmployeeCompensation::TYPE_WEEKLY && $date->dayOfWeekIso !== 1 && $hasEarlierCompensation) {
                throw PayrollException::invalidWeeklyCompensationDate();
            }

            $previous = $lockedEmployee->compensations()
                ->whereDate('effective_from', '<', $date)
                ->orderByDesc('effective_from')->lockForUpdate()->first();
            $next = $lockedEmployee->compensations()
                ->whereDate('effective_from', '>', $date)
                ->orderBy('effective_from')->lockForUpdate()->first();

            $closedPeriodQuery = PayrollPeriod::query()
                ->where('status', PayrollPeriod::STATUS_CLOSED)
                ->whereDate('ends_on', '>=', $date)
                ->whereHas('lines', fn ($query) => $query->where('employee_profile_id', $lockedEmployee->id));
            if ($next) {
                $closedPeriodQuery->whereDate('starts_on', '<', $next->effective_from);
            }
            if ($closedPeriodQuery->exists()) {
                throw PayrollException::compensationInsideClosedPeriod();
            }

            if ($previous) {
                $previous->update(['effective_to' => $date->subDay()->toDateString()]);
            }

            return $lockedEmployee->compensations()->updateOrCreate(
                ['effective_from' => $date->toDateString()],
                [
                    'pay_type' => $payType,
                    'amount' => $amount,
                    'expected_minutes' => $expectedMinutes,
                    'effective_to' => $next?->effective_from?->copy()->subDay()->toDateString(),
                    'created_by' => $createdBy,
                    'notes' => $notes,
                ],
            );
        });
    }
}
