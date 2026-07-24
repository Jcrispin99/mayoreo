<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\SaleFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $warehouse_id
 * @property int|null $cash_register_session_id
 * @property int|null $pos_order_id
 * @property int|null $customer_id
 * @property string $source
 * @property string|null $customer_name
 * @property string|null $customer_document
 * @property string|null $notes
 * @property string $status
 * @property string $subtotal
 * @property string $total
 * @property string $payable_total
 * @property Carbon $sold_at
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class Sale extends Model
{
    /** @use HasFactory<SaleFactory> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'warehouse_id',
        'cash_register_session_id',
        'pos_order_id',
        'customer_id',
        'source',
        'customer_name',
        'customer_document',
        'notes',
        'status',
        'subtotal',
        'total',
        'payable_total',
        'sold_at',
        'created_by',
    ];

    /**
     * @return BelongsTo<Warehouse, $this>
     */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    /** @return BelongsTo<CashRegisterSession, $this> */
    public function cashRegisterSession(): BelongsTo
    {
        return $this->belongsTo(CashRegisterSession::class);
    }

    /** @return BelongsTo<PosOrder, $this> */
    public function posOrder(): BelongsTo
    {
        return $this->belongsTo(PosOrder::class);
    }

    /** @return BelongsTo<Customer, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return MorphMany<Productable, $this>
     */
    public function items(): MorphMany
    {
        return $this->morphMany(Productable::class, 'productable');
    }

    /**
     * @return HasMany<FiscalDocument, $this>
     */
    public function fiscalDocuments(): HasMany
    {
        return $this->hasMany(FiscalDocument::class);
    }

    /** @return HasMany<SalePayment, $this> */
    public function payments(): HasMany
    {
        return $this->hasMany(SalePayment::class);
    }

    /** @return HasOne<SalePayment, $this> */
    public function payment(): HasOne
    {
        return $this->hasOne(SalePayment::class);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:4',
            'total' => 'decimal:4',
            'payable_total' => 'decimal:2',
            'sold_at' => 'datetime',
        ];
    }
}
