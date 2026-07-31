<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Product
 */
final class ProductResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $imageUrl = $this->image_url;
        if ($imageUrl === null && $this->relationLoaded('template')) {
            $imageUrl = $this->template?->image_url;
        }

        return [
            'id' => $this->id,
            'product_template_id' => $this->product_template_id,
            'template' => new ProductTemplateResource($this->whenLoaded('template')),
            'sku' => $this->sku,
            'barcode' => $this->barcode,
            'name' => $this->name,
            'display_name' => $this->display_name,
            'variant_name' => $this->variant_name,
            'description' => $this->description,
            'image_url' => $imageUrl,
            'base_unit_id' => $this->base_unit_id,
            'base_unit' => new UnitOfMeasureResource($this->whenLoaded('baseUnit')),
            'sale_mode' => $this->sale_mode,
            'content_quantity' => $this->content_quantity,
            'content_unit_id' => $this->content_unit_id,
            'content_unit' => new UnitOfMeasureResource($this->whenLoaded('contentUnit')),
            'attribute_values' => $this->relationLoaded('attributeValues')
                ? $this->attributeValues->map(fn ($attributeValue): array => [
                    'id' => $attributeValue->id,
                    'attribute_id' => $attributeValue->product_attribute_id,
                    'attribute' => $attributeValue->attribute->name,
                    'value' => $attributeValue->value,
                ])->values()
                : [],
            'is_active' => $this->is_active,
            'is_favorite' => $this->is_favorite,
            'is_principal' => $this->is_principal,
            'purchase_units' => ProductPurchaseUnitResource::collection($this->whenLoaded('purchaseUnits')),
            'price_tiers' => PriceTierResource::collection($this->whenLoaded('priceTiers')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
