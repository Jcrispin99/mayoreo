<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\PriceTierFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $product_id
 * @property string $min_quantity
 * @property string|null $max_quantity
 * @property string $unit_price
 * @property string|null $label
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class PriceTier extends Model
{
    /** @use HasFactory<PriceTierFactory> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'product_id',
        'min_quantity',
        'max_quantity',
        'unit_price',
        'label',
        'is_active',
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
            'min_quantity' => 'decimal:6',
            'max_quantity' => 'decimal:6',
            'unit_price' => 'decimal:4',
            'is_active' => 'boolean',
        ];
    }
}
