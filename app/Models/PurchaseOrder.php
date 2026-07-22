<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\PurchaseOrderFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string|null $series_code
 * @property int|null $number
 * @property int $supplier_id
 * @property int $warehouse_id
 * @property string $status
 * @property Carbon $ordered_at
 * @property string|null $invoice_series
 * @property string|null $invoice_number
 * @property string $total
 * @property Carbon|null $received_at
 * @property string|null $notes
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class PurchaseOrder extends Model
{
    /** @use HasFactory<PurchaseOrderFactory> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'series_code',
        'number',
        'supplier_id',
        'warehouse_id',
        'status',
        'ordered_at',
        'invoice_series',
        'invoice_number',
        'total',
        'received_at',
        'notes',
        'created_by',
    ];

    /**
     * @return BelongsTo<Supplier, $this>
     */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    /**
     * @return BelongsTo<Warehouse, $this>
     */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
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
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'number' => 'integer',
            'total' => 'decimal:4',
            'ordered_at' => 'date',
            'received_at' => 'datetime',
        ];
    }
}
