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
        string $effectiveFrom,
        ?int $createdBy,
        ?string $notes,
    ): EmployeeCompensation {
        return DB::transaction(function () use ($employee, $payType, $amount, $effectiveFrom, $createdBy, $notes): EmployeeCompensation {
            $date = CarbonImmutable::parse($effectiveFrom)->startOfDay();
            $lockedEmployee = EmployeeProfile::query()->lockForUpdate()->findOrFail($employee->id);

            $hasEarlierMonthly = $lockedEmployee->compensations()
                ->where('pay_type', EmployeeCompensation::TYPE_MONTHLY)
                ->whereDate('effective_from', '<', $date)->exists();
            if ($payType === EmployeeCompensation::TYPE_MONTHLY && $date->day !== 1 && $hasEarlierMonthly) {
                throw PayrollException::invalidMonthlyCompensationDate();
            }

            $previous = $lockedEmployee->compensations()
                ->whereDate('effective_from', '<', $date)
                ->orderByDesc('effective_from')->lockForUpdate()->first();
            $next = $lockedEmployee->compensations()
                ->whereDate('effective_from', '>', $date)
                ->orderBy('effective_from')->lockForUpdate()->first();

            $closedPeriodQuery = PayrollPeriod::query()
                ->where('status', PayrollPeriod::STATUS_CLOSED)
                ->whereDate('ends_on', '>=', $date);
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
                    'effective_to' => $next?->effective_from?->copy()->subDay()->toDateString(),
                    'created_by' => $createdBy,
                    'notes' => $notes,
                ],
            );
        });
    }
}
