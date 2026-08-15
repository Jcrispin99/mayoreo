<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

/**
 * @property int $id
 * @property string $name
 * @property string|null $description
 * @property string|null $image_path
 * @property bool $is_active
 * @property bool $is_pos_visible
 * @property-read string|null $image_url
 */
final class ProductTemplate extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'description',
        'image_path',
        'is_active',
        'is_pos_visible',
    ];

    /**
     * @return HasMany<Product, $this>
     */
    public function variants(): HasMany
    {
        return $this->hasMany(Product::class)->orderByDesc('is_principal')->orderBy('id');
    }

    /**
     * @return HasOne<Product, $this>
     */
    public function principalVariant(): HasOne
    {
        return $this->hasOne(Product::class)->where('is_principal', true);
    }

    /**
     * @return BelongsToMany<ProductAttributeValue, $this>
     */
    public function attributeValues(): BelongsToMany
    {
        return $this->belongsToMany(
            ProductAttributeValue::class,
            'product_template_attribute_value',
        )->withPivot('position', 'price', 'factor')->orderByPivot('position');
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

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'is_pos_visible' => 'boolean',
        ];
    }
}
