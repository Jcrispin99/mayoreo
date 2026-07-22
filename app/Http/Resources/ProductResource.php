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
        return [
            'id' => $this->id,
            'sku' => $this->sku,
            'barcode' => $this->barcode,
            'name' => $this->name,
            'description' => $this->description,
            'image_url' => $this->image_url,
            'base_unit_id' => $this->base_unit_id,
            'base_unit' => new UnitOfMeasureResource($this->whenLoaded('baseUnit')),
            'is_active' => $this->is_active,
            'is_favorite' => $this->is_favorite,
            'purchase_units' => ProductPurchaseUnitResource::collection($this->whenLoaded('purchaseUnits')),
            'price_tiers' => PriceTierResource::collection($this->whenLoaded('priceTiers')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
