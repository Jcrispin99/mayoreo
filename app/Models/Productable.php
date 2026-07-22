<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\ProductableFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;

/**
 * Línea de detalle polimórfica compartida por PurchaseOrder, Sale e InventoryTransfer.
 *
 * @property int $id
 * @property int $product_id
 * @property string $productable_type
 * @property int $productable_id
 * @property string $quantity
 * @property int|null $product_purchase_unit_id
 * @property string|null $quantity_purchased
 * @property string|null $input_quantity
 * @property int|null $input_unit_id
 * @property int|null $price_tier_id
 * @property string|null $unit_price
 * @property string|null $line_total
 * @property string|null $unit_cost
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class Productable extends Model
{
    /** @use HasFactory<ProductableFactory> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'product_id',
        'productable_type',
        'productable_id',
        'quantity',
        'product_purchase_unit_id',
        'quantity_purchased',
        'input_quantity',
        'input_unit_id',
        'price_tier_id',
        'unit_price',
        'line_total',
        'unit_cost',
    ];

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * @return MorphTo<Model, $this>
     */
    public function productable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * @return BelongsTo<ProductPurchaseUnit, $this>
     */
    public function productPurchaseUnit(): BelongsTo
    {
        return $this->belongsTo(ProductPurchaseUnit::class);
    }

    /**
     * @return BelongsTo<UnitOfMeasure, $this>
     */
    public function inputUnit(): BelongsTo
    {
        return $this->belongsTo(UnitOfMeasure::class, 'input_unit_id');
    }

    /**
     * @return BelongsTo<PriceTier, $this>
     */
    public function priceTier(): BelongsTo
    {
        return $this->belongsTo(PriceTier::class);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:6',
            'quantity_purchased' => 'decimal:6',
            'input_quantity' => 'decimal:6',
            'unit_price' => 'decimal:4',
            'line_total' => 'decimal:4',
            'unit_cost' => 'decimal:4',
        ];
    }
}
