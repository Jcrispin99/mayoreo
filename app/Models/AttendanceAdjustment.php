<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $attendance_shift_id
 * @property int|null $adjusted_by
 * @property Carbon $previous_clocked_in_at
 * @property Carbon|null $previous_clocked_out_at
 * @property Carbon $new_clocked_in_at
 * @property Carbon|null $new_clocked_out_at
 * @property string $reason
 */
final class AttendanceAdjustment extends Model
{
    protected $fillable = [
        'attendance_shift_id', 'adjusted_by', 'previous_clocked_in_at', 'previous_clocked_out_at',
        'new_clocked_in_at', 'new_clocked_out_at', 'reason',
    ];

    /** @return BelongsTo<AttendanceShift, $this> */
    public function shift(): BelongsTo
    {
        return $this->belongsTo(AttendanceShift::class, 'attendance_shift_id');
    }

    /** @return BelongsTo<User, $this> */
    public function adjuster(): BelongsTo
    {
        return $this->belongsTo(User::class, 'adjusted_by');
    }

    protected function casts(): array
    {
        return [
            'previous_clocked_in_at' => 'datetime', 'previous_clocked_out_at' => 'datetime',
            'new_clocked_in_at' => 'datetime', 'new_clocked_out_at' => 'datetime',
        ];
    }
}
