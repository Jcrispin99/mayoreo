<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $supplier_id
 * @property int $product_id
 * @property int|null $product_purchase_unit_id
 * @property string $unit_cost
 * @property Carbon $quoted_at
 * @property string|null $notes
 * @property int|null $updated_by
 */
final class SupplierProductPrice extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'supplier_id',
        'product_id',
        'product_purchase_unit_id',
        'unit_cost',
        'quoted_at',
        'notes',
        'updated_by',
    ];

    /** @return BelongsTo<Supplier, $this> */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** @return BelongsTo<ProductPurchaseUnit, $this> */
    public function purchaseUnit(): BelongsTo
    {
        return $this->belongsTo(ProductPurchaseUnit::class, 'product_purchase_unit_id');
    }

    /** @return BelongsTo<User, $this> */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'unit_cost' => 'decimal:4',
            'quoted_at' => 'date',
        ];
    }
}
