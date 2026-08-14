<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $payroll_period_id
 * @property int $employee_profile_id
 * @property string $pay_type
 * @property numeric-string $rate_amount
 * @property int|null $monthly_divisor
 * @property int $scheduled_days
 * @property int $valid_days
 * @property int $absence_days
 * @property int $incident_days
 * @property int $worked_minutes
 * @property numeric-string $base_amount
 * @property numeric-string $attendance_deduction
 * @property numeric-string $special_day_bonus
 * @property numeric-string $worked_day_equivalents
 * @property int $special_day_minutes
 * @property array<int, mixed>|null $special_day_details
 * @property numeric-string $calculated_amount
 * @property numeric-string $adjustments_amount
 * @property numeric-string $payable_amount
 * @property string|null $notes
 */
final class PayrollLine extends Model
{
    protected $fillable = [
        'payroll_period_id', 'employee_profile_id', 'pay_type', 'rate_amount', 'monthly_divisor',
        'scheduled_days', 'valid_days', 'absence_days', 'incident_days', 'worked_minutes',
        'base_amount', 'attendance_deduction', 'special_day_bonus', 'worked_day_equivalents',
        'special_day_minutes', 'special_day_details', 'calculated_amount', 'adjustments_amount',
        'payable_amount', 'notes',
    ];

    /** @return BelongsTo<PayrollPeriod, $this> */
    public function period(): BelongsTo
    {
        return $this->belongsTo(PayrollPeriod::class, 'payroll_period_id');
    }

    /** @return BelongsTo<EmployeeProfile, $this> */
    public function employeeProfile(): BelongsTo
    {
        return $this->belongsTo(EmployeeProfile::class);
    }

    protected function casts(): array
    {
        return [
            'rate_amount' => 'decimal:2', 'calculated_amount' => 'decimal:2',
            'base_amount' => 'decimal:2', 'attendance_deduction' => 'decimal:2',
            'special_day_bonus' => 'decimal:2', 'worked_day_equivalents' => 'decimal:4',
            'adjustments_amount' => 'decimal:2', 'payable_amount' => 'decimal:2',
            'monthly_divisor' => 'integer', 'scheduled_days' => 'integer', 'valid_days' => 'integer',
            'absence_days' => 'integer', 'incident_days' => 'integer', 'worked_minutes' => 'integer',
            'special_day_minutes' => 'integer', 'special_day_details' => 'array',
        ];
    }
}
