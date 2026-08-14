<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $employee_profile_id
 * @property int $store_id
 * @property Carbon $clocked_in_at
 * @property Carbon|null $clocked_out_at
 * @property int|null $worked_minutes
 * @property string $status
 * @property string $source
 */
final class AttendanceShift extends Model
{
    public const STATUS_OPEN = 'open';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_INCIDENT = 'incident';

    protected $fillable = [
        'employee_profile_id', 'store_id', 'clocked_in_at', 'clocked_out_at', 'worked_minutes', 'status', 'source',
    ];

    /** @return BelongsTo<EmployeeProfile, $this> */
    public function employeeProfile(): BelongsTo
    {
        return $this->belongsTo(EmployeeProfile::class);
    }

    /** @return BelongsTo<Store, $this> */
    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    /** @return HasMany<AttendanceEvent, $this> */
    public function events(): HasMany
    {
        return $this->hasMany(AttendanceEvent::class);
    }

    /** @return HasMany<AttendanceAdjustment, $this> */
    public function adjustments(): HasMany
    {
        return $this->hasMany(AttendanceAdjustment::class);
    }

    protected function casts(): array
    {
        return [
            'clocked_in_at' => 'datetime',
            'clocked_out_at' => 'datetime',
            'worked_minutes' => 'integer',
        ];
    }
}
