<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $user_id
 * @property int|null $store_id
 * @property string $employment_status
 * @property Carbon $hired_at
 * @property Carbon|null $terminated_at
 * @property int $expected_minutes_per_day
 * @property int $monthly_divisor
 * @property array<int, int> $work_days
 * @property-read User $user
 * @property-read Store|null $store
 */
final class EmployeeProfile extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    protected $fillable = [
        'user_id', 'store_id', 'employment_status', 'hired_at', 'terminated_at',
        'expected_minutes_per_day', 'monthly_divisor', 'work_days',
    ];

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Store, $this> */
    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    /** @return HasMany<EmployeeCompensation, $this> */
    public function compensations(): HasMany
    {
        return $this->hasMany(EmployeeCompensation::class)->orderByDesc('effective_from');
    }

    /** @return HasMany<AttendanceShift, $this> */
    public function shifts(): HasMany
    {
        return $this->hasMany(AttendanceShift::class);
    }

    /** @return HasOne<AttendanceShift, $this> */
    public function currentShift(): HasOne
    {
        return $this->hasOne(AttendanceShift::class)->where('status', AttendanceShift::STATUS_OPEN)->latestOfMany();
    }

    /** @return HasMany<PayrollLine, $this> */
    public function payrollLines(): HasMany
    {
        return $this->hasMany(PayrollLine::class);
    }

    protected function casts(): array
    {
        return [
            'hired_at' => 'date',
            'terminated_at' => 'date',
            'expected_minutes_per_day' => 'integer',
            'monthly_divisor' => 'integer',
            'work_days' => 'array',
        ];
    }
}
