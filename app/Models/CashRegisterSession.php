<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $cash_register_id
 * @property int|null $opened_by
 * @property int|null $closed_by
 * @property string $status
 * @property numeric-string $opening_amount
 * @property numeric-string|null $expected_amount
 * @property numeric-string|null $counted_amount
 * @property numeric-string|null $difference_amount
 * @property string|null $opening_notes
 * @property string|null $closing_notes
 * @property Carbon $opened_at
 * @property Carbon|null $closed_at
 */
final class CashRegisterSession extends Model
{
    protected $fillable = [
        'cash_register_id',
        'opened_by',
        'closed_by',
        'status',
        'opening_amount',
        'expected_amount',
        'counted_amount',
        'difference_amount',
        'opening_notes',
        'closing_notes',
        'opened_at',
        'closed_at',
    ];

    /** @return BelongsTo<CashRegister, $this> */
    public function cashRegister(): BelongsTo
    {
        return $this->belongsTo(CashRegister::class);
    }

    /** @return BelongsTo<User, $this> */
    public function opener(): BelongsTo
    {
        return $this->belongsTo(User::class, 'opened_by');
    }

    /** @return BelongsTo<User, $this> */
    public function closer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    /** @return HasMany<CashRegisterMovement, $this> */
    public function movements(): HasMany
    {
        return $this->hasMany(CashRegisterMovement::class);
    }

    /** @return HasMany<PosOrder, $this> */
    public function orders(): HasMany
    {
        return $this->hasMany(PosOrder::class);
    }

    /** @return numeric-string */
    public function incomeTotal(): string
    {
        return $this->movementTotal('income');
    }

    /** @return numeric-string */
    public function expenseTotal(): string
    {
        return $this->movementTotal('expense');
    }

    /** @return numeric-string */
    public function liveExpectedAmount(): string
    {
        return bcsub(
            bcadd((string) $this->opening_amount, $this->incomeTotal(), 2),
            $this->expenseTotal(),
            2,
        );
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'opening_amount' => 'decimal:2',
            'expected_amount' => 'decimal:2',
            'counted_amount' => 'decimal:2',
            'difference_amount' => 'decimal:2',
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    /**
     * @param  'income'|'expense'  $type
     * @return numeric-string
     */
    private function movementTotal(string $type): string
    {
        if ($this->relationLoaded('movements')) {
            $total = '0.00';
            foreach ($this->movements->where('type', $type) as $movement) {
                $total = bcadd($total, $movement->amount, 2);
            }

            return $total;
        }

        $sum = $this->movements()->where('type', $type)->sum('amount');

        return bcadd((string) $sum, '0', 2);
    }
}
