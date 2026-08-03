<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $pos_supply_request_id
 * @property int $product_id
 * @property string $requested_quantity
 * @property string $prepared_quantity
 * @property string|null $warehouse_notes
 * @property string|null $change_type
 * @property int $changed_version
 * @property int|null $prepared_by
 * @property Carbon|null $prepared_at
 */
final class PosSupplyRequestItem extends Model
{
    protected $fillable = [
        'product_id',
        'requested_quantity',
        'prepared_quantity',
        'warehouse_notes',
        'change_type',
        'changed_version',
        'prepared_by',
        'prepared_at',
    ];

    /** @return BelongsTo<PosSupplyRequest, $this> */
    public function supplyRequest(): BelongsTo
    {
        return $this->belongsTo(PosSupplyRequest::class, 'pos_supply_request_id');
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** @return BelongsTo<User, $this> */
    public function preparer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'prepared_by');
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'requested_quantity' => 'decimal:6',
            'prepared_quantity' => 'decimal:6',
            'prepared_at' => 'datetime',
        ];
    }
}
