<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\ProductFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * @property int $id
 * @property string $sku
 * @property string|null $barcode
 * @property string $name
 * @property string|null $description
 * @property string|null $image_path
 * @property int $base_unit_id
 * @property bool $is_active
 * @property bool $is_favorite
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 */
final class Product extends Model
{
    /** @use HasFactory<ProductFactory> */
    use HasFactory;

    use SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'sku',
        'barcode',
        'name',
        'description',
        'image_path',
        'base_unit_id',
        'is_active',
        'is_favorite',
    ];

    /**
     * @return BelongsTo<UnitOfMeasure, $this>
     */
    public function baseUnit(): BelongsTo
    {
        return $this->belongsTo(UnitOfMeasure::class, 'base_unit_id');
    }

    /**
     * @return HasMany<ProductPurchaseUnit, $this>
     */
    public function purchaseUnits(): HasMany
    {
        return $this->hasMany(ProductPurchaseUnit::class);
    }

    /**
     * @return HasMany<PriceTier, $this>
     */
    public function priceTiers(): HasMany
    {
        return $this->hasMany(PriceTier::class);
    }

    /**
     * @return HasMany<Stock, $this>
     */
    public function stocks(): HasMany
    {
        return $this->hasMany(Stock::class);
    }

    /**
     * @return HasMany<Productable, $this>
     */
    public function productables(): HasMany
    {
        return $this->hasMany(Productable::class);
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function imageUrl(): Attribute
    {
        return Attribute::make(
            get: fn (): ?string => $this->image_path ? Storage::disk('public')->url($this->image_path) : null,
        );
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'is_favorite' => 'boolean',
        ];
    }
}
