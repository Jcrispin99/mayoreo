<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $sale_id
 * @property int|null $cash_register_session_id
 * @property string $method
 * @property numeric-string $amount
 * @property numeric-string|null $received_amount
 * @property numeric-string $change_amount
 * @property string|null $reference
 * @property string $status
 * @property Carbon $paid_at
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class SalePayment extends Model
{
    public const STATUS_COMPLETED = 'completed';

    protected $fillable = [
        'sale_id',
        'cash_register_session_id',
        'method',
        'amount',
        'received_amount',
        'change_amount',
        'reference',
        'status',
        'paid_at',
        'created_by',
    ];

    /** @return BelongsTo<Sale, $this> */
    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

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
            'received_amount' => 'decimal:2',
            'change_amount' => 'decimal:2',
            'paid_at' => 'datetime',
        ];
    }
}
