<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $cash_register_session_id
 * @property int $number
 * @property string $status
 * @property string $subtotal
 * @property string $total
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class PosOrder extends Model
{
    protected $fillable = [
        'cash_register_session_id',
        'number',
        'status',
        'subtotal',
        'total',
        'created_by',
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

    /** @return MorphMany<Productable, $this> */
    public function items(): MorphMany
    {
        return $this->morphMany(Productable::class, 'productable');
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:4',
            'total' => 'decimal:4',
        ];
    }
}
