<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $cash_register_session_id
 * @property int|null $customer_id
 * @property int $number
 * @property string $status
 * @property string $subtotal
 * @property string $total
 * @property int|null $created_by
 * @property int|null $completed_by
 * @property Carbon|null $completed_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class PosOrder extends Model
{
    protected $fillable = [
        'cash_register_session_id',
        'customer_id',
        'number',
        'status',
        'subtotal',
        'total',
        'created_by',
        'completed_by',
        'completed_at',
    ];

    /** @return BelongsTo<CashRegisterSession, $this> */
    public function cashRegisterSession(): BelongsTo
    {
        return $this->belongsTo(CashRegisterSession::class);
    }

    /** @return BelongsTo<Customer, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return BelongsTo<User, $this> */
    public function completer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by');
    }

    /** @return MorphMany<Productable, $this> */
    public function items(): MorphMany
    {
        return $this->morphMany(Productable::class, 'productable');
    }

    /** @return HasOne<Sale, $this> */
    public function sale(): HasOne
    {
        return $this->hasOne(Sale::class);
    }

    /**
     * Comandas hacia el almacén de medio: traslados que reponen stock
     * faltante de esta orden en el almacén de la caja.
     *
     * @return HasMany<InventoryTransfer, $this>
     */
    public function supplyRequests(): HasMany
    {
        return $this->hasMany(InventoryTransfer::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:4',
            'total' => 'decimal:4',
            'completed_at' => 'datetime',
        ];
    }
}
