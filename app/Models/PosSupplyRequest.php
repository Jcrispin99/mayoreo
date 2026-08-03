<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $pos_order_id
 * @property int $from_warehouse_id
 * @property int $to_warehouse_id
 * @property int|null $assigned_to
 * @property int|null $assigned_by
 * @property int|null $inventory_transfer_id
 * @property string $status
 * @property string|null $warehouse_notes
 * @property int $version
 * @property int $acknowledged_version
 * @property int $warehouse_notes_changed_version
 * @property Carbon|null $assigned_at
 * @property Carbon|null $acknowledged_at
 * @property Carbon|null $ready_at
 * @property Carbon|null $delivered_at
 * @property Carbon|null $cancelled_at
 */
final class PosSupplyRequest extends Model
{
    protected $fillable = [
        'pos_order_id',
        'from_warehouse_id',
        'to_warehouse_id',
        'assigned_to',
        'assigned_by',
        'inventory_transfer_id',
        'status',
        'warehouse_notes',
        'version',
        'acknowledged_version',
        'warehouse_notes_changed_version',
        'assigned_at',
        'acknowledged_at',
        'ready_at',
        'delivered_at',
        'cancelled_at',
    ];

    /** @return BelongsTo<PosOrder, $this> */
    public function posOrder(): BelongsTo
    {
        return $this->belongsTo(PosOrder::class);
    }

    /** @return BelongsTo<Warehouse, $this> */
    public function fromWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'from_warehouse_id');
    }

    /** @return BelongsTo<Warehouse, $this> */
    public function toWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'to_warehouse_id');
    }

    /** @return BelongsTo<User, $this> */
    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    /** @return BelongsTo<User, $this> */
    public function assigner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    /** @return BelongsTo<InventoryTransfer, $this> */
    public function inventoryTransfer(): BelongsTo
    {
        return $this->belongsTo(InventoryTransfer::class);
    }

    /** @return HasMany<PosSupplyRequestItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(PosSupplyRequestItem::class);
    }

    /** @return HasMany<PosSupplyRequestChange, $this> */
    public function changes(): HasMany
    {
        return $this->hasMany(PosSupplyRequestChange::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'assigned_at' => 'datetime',
            'acknowledged_at' => 'datetime',
            'ready_at' => 'datetime',
            'delivered_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }
}
