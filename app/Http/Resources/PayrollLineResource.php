<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\PayrollLine;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin PayrollLine */
final class PayrollLineResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'payroll_period_id' => $this->payroll_period_id,
            'period' => new PayrollPeriodResource($this->whenLoaded('period')),
            'employee_profile_id' => $this->employee_profile_id,
            'employee' => new EmployeeProfileResource($this->whenLoaded('employeeProfile')),
            'pay_type' => $this->pay_type,
            'rate_amount' => $this->rate_amount,
            'monthly_divisor' => $this->monthly_divisor,
            'scheduled_days' => $this->scheduled_days,
            'valid_days' => $this->valid_days,
            'absence_days' => $this->absence_days,
            'incident_days' => $this->incident_days,
            'worked_minutes' => $this->worked_minutes,
            'base_amount' => $this->base_amount,
            'attendance_deduction' => $this->attendance_deduction,
            'special_day_bonus' => $this->special_day_bonus,
            'worked_day_equivalents' => $this->worked_day_equivalents,
            'special_day_minutes' => $this->special_day_minutes,
            'special_day_details' => $this->special_day_details ?? [],
            'calculated_amount' => $this->calculated_amount,
            'adjustments_amount' => $this->adjustments_amount,
            'payable_amount' => $this->payable_amount,
            'notes' => $this->notes,
        ];
    }
}
