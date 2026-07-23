<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $cash_register_session_id
 * @property string $type
 * @property numeric-string $amount
 * @property string $reason
 * @property string|null $notes
 * @property int|null $created_by
 * @property Carbon $occurred_at
 */
final class CashRegisterMovement extends Model
{
    protected $fillable = [
        'cash_register_session_id',
        'type',
        'amount',
        'reason',
        'notes',
        'created_by',
        'occurred_at',
    ];

    /** @return BelongsTo<CashRegisterSession, $this> */
    public function cashRegisterSession(): BelongsTo
    {
        return $this->belongsTo(CashRegisterSession::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'occurred_at' => 'datetime',
        ];
    }
}
