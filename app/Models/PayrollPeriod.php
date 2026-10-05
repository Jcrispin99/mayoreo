<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property Carbon $starts_on
 * @property Carbon $ends_on
 * @property string $pay_frequency
 * @property string $status
 * @property int|null $created_by
 * @property int|null $closed_by
 * @property Carbon|null $closed_at
 */
final class PayrollPeriod extends Model
{
    public const FREQUENCY_MONTHLY = 'monthly';

    public const FREQUENCY_WEEKLY = 'weekly';

    public const STATUS_OPEN = 'open';

    public const STATUS_CLOSED = 'closed';

    protected $fillable = ['starts_on', 'ends_on', 'pay_frequency', 'status', 'created_by', 'closed_by', 'closed_at'];

    /** @return HasMany<PayrollLine, $this> */
    public function lines(): HasMany
    {
        return $this->hasMany(PayrollLine::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return BelongsTo<User, $this> */
    public function closer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    protected function casts(): array
    {
        return ['starts_on' => 'date', 'ends_on' => 'date', 'closed_at' => 'datetime'];
    }
}
