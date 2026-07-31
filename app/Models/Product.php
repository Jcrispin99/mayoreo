<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\ProductFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * @property int $id
 * @property int|null $product_template_id
 * @property string $sku
 * @property string|null $barcode
 * @property string $name
 * @property string|null $variant_name
 * @property string|null $description
 * @property string|null $image_path
 * @property int $base_unit_id
 * @property string $sale_mode
 * @property string|null $content_quantity
 * @property int|null $content_unit_id
 * @property bool $is_active
 * @property bool $is_favorite
 * @property bool $is_principal
 * @property-read string $display_name
 * @property-read string|null $image_url
 * @property-read ProductTemplate|null $template
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
        'product_template_id',
        'sku',
        'barcode',
        'name',
        'variant_name',
        'description',
        'image_path',
        'base_unit_id',
        'sale_mode',
        'content_quantity',
        'content_unit_id',
        'is_active',
        'is_favorite',
        'is_principal',
    ];

    /**
     * @return BelongsTo<ProductTemplate, $this>
     */
    public function template(): BelongsTo
    {
        return $this->belongsTo(ProductTemplate::class, 'product_template_id');
    }

    /**
     * @return BelongsTo<UnitOfMeasure, $this>
     */
    public function baseUnit(): BelongsTo
    {
        return $this->belongsTo(UnitOfMeasure::class, 'base_unit_id');
    }

    /**
     * @return BelongsTo<UnitOfMeasure, $this>
     */
    public function contentUnit(): BelongsTo
    {
        return $this->belongsTo(UnitOfMeasure::class, 'content_unit_id');
    }

    /**
     * @return BelongsToMany<ProductAttributeValue, $this>
     */
    public function attributeValues(): BelongsToMany
    {
        return $this->belongsToMany(
            ProductAttributeValue::class,
            'product_attribute_value_product',
        )->with('attribute')->orderBy('product_attribute_values.id');
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
     * @return HasMany<InventoryMovement, $this>
     */
    public function inventoryMovements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class);
    }

    public function hasOperationalHistory(): bool
    {
        return $this->productables()->exists() || $this->inventoryMovements()->exists();
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
     * @return Attribute<string, never>
     */
    protected function displayName(): Attribute
    {
        return Attribute::make(
            get: function (): string {
                $template = $this->relationLoaded('template') ? $this->template : null;
                $templateName = $template instanceof ProductTemplate ? $template->name : null;

                if ($templateName && $this->variant_name) {
                    return "{$templateName} - {$this->variant_name}";
                }

                return $templateName ?: $this->name;
            },
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
            'is_principal' => 'boolean',
            'content_quantity' => 'decimal:6',
        ];
    }
}
