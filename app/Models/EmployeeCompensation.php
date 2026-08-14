<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $employee_profile_id
 * @property string $pay_type
 * @property numeric-string $amount
 * @property Carbon $effective_from
 * @property Carbon|null $effective_to
 * @property int|null $created_by
 * @property string|null $notes
 */
final class EmployeeCompensation extends Model
{
    public const TYPE_MONTHLY = 'monthly';

    public const TYPE_DAILY = 'daily';

    protected $table = 'employee_compensations';

    protected $fillable = [
        'employee_profile_id', 'pay_type', 'amount', 'effective_from', 'effective_to', 'created_by', 'notes',
    ];

    /** @return BelongsTo<EmployeeProfile, $this> */
    public function employeeProfile(): BelongsTo
    {
        return $this->belongsTo(EmployeeProfile::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'effective_from' => 'date',
            'effective_to' => 'date',
        ];
    }
}
