<?php

declare(strict_types=1);

namespace App\Actions\Payroll;

use App\Exceptions\PayrollException;
use App\Models\PayrollPeriod;
use Illuminate\Support\Facades\DB;

final readonly class CreatePayrollPeriodAction
{
    public function __construct(private RecalculatePayrollPeriodAction $recalculate) {}

    public function execute(string $startsOn, string $endsOn, string $payFrequency, ?int $createdBy): PayrollPeriod
    {
        $period = DB::transaction(function () use ($startsOn, $endsOn, $payFrequency, $createdBy): PayrollPeriod {
            if (PayrollPeriod::query()->whereDate('starts_on', '<=', $endsOn)
                ->whereDate('ends_on', '>=', $startsOn)
                ->where('pay_frequency', $payFrequency)
                ->lockForUpdate()->exists()) {
                throw PayrollException::overlappingPeriod();
            }

            return PayrollPeriod::query()->create([
                'starts_on' => $startsOn,
                'ends_on' => $endsOn,
                'pay_frequency' => $payFrequency,
                'status' => PayrollPeriod::STATUS_OPEN,
                'created_by' => $createdBy,
            ]);
        });

        return $this->recalculate->execute($period);
    }
}
