<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $attendance_shift_id
 * @property int $employee_profile_id
 * @property int $store_id
 * @property string $type
 * @property Carbon $occurred_at
 * @property string $source
 * @property int|null $recorded_by
 * @property array<string, mixed>|null $metadata
 */
final class AttendanceEvent extends Model
{
    protected $fillable = [
        'attendance_shift_id', 'employee_profile_id', 'store_id', 'type', 'occurred_at', 'source', 'recorded_by', 'metadata',
    ];

    /** @return BelongsTo<AttendanceShift, $this> */
    public function shift(): BelongsTo
    {
        return $this->belongsTo(AttendanceShift::class, 'attendance_shift_id');
    }

    protected function casts(): array
    {
        return ['occurred_at' => 'datetime', 'metadata' => 'array'];
    }
}
