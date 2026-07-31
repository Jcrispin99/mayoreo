<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * @property int $id
 * @property int $product_attribute_id
 * @property string $value
 * @property bool $is_active
 * @property-read ProductAttribute $attribute
 * @property-read \Illuminate\Database\Eloquent\Relations\Pivot $pivot
 */
final class ProductAttributeValue extends Model
{
    /** @var list<string> */
    protected $fillable = ['product_attribute_id', 'value', 'is_active'];

    /** @return BelongsTo<ProductAttribute, $this> */
    public function attribute(): BelongsTo
    {
        return $this->belongsTo(ProductAttribute::class, 'product_attribute_id');
    }

    /** @return BelongsToMany<ProductTemplate, $this> */
    public function productTemplates(): BelongsToMany
    {
        return $this->belongsToMany(
            ProductTemplate::class,
            'product_template_attribute_value',
        )->withPivot('position', 'price', 'factor');
    }

    /** @return BelongsToMany<Product, $this> */
    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'product_attribute_value_product');
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
