<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\ProductPurchaseUnitFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $product_id
 * @property string $name
 * @property string $conversion_factor
 * @property string|null $barcode
 * @property bool $is_default_purchase
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class ProductPurchaseUnit extends Model
{
    /** @use HasFactory<ProductPurchaseUnitFactory> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'product_id',
        'name',
        'conversion_factor',
        'barcode',
        'is_default_purchase',
    ];

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'conversion_factor' => 'decimal:6',
            'is_default_purchase' => 'boolean',
        ];
    }
}
