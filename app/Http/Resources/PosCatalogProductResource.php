<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Product */
final class PosCatalogProductResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_template_id' => $this->product_template_id,
            'sku' => $this->sku,
            'barcode' => $this->barcode,
            'name' => $this->display_name,
            'variant_name' => $this->variant_name,
            'image_url' => $this->image_url,
            'base_unit' => new UnitOfMeasureResource($this->whenLoaded('baseUnit')),
            'sale_mode' => $this->sale_mode,
            'content_quantity' => $this->content_quantity,
            'content_unit' => new UnitOfMeasureResource($this->whenLoaded('contentUnit')),
            'stock_available' => $this->availableStock(),
            'stock_configuration_error' => $this->getAttribute('stock_configuration_error'),
            'price_tiers' => PriceTierResource::collection($this->whenLoaded('priceTiers')),
            'is_favorite' => $this->is_favorite,
            'price_changed_at' => $this->price_changed_at?->toIso8601String(),
            'price_highlight_until' => $this->price_highlight_until?->toIso8601String(),
        ];
    }

    private function availableStock(): string
    {
        $resolvedStock = $this->getAttribute('resolved_stock_available');
        if (is_string($resolvedStock)) {
            return $resolvedStock;
        }

        $stock = $this->stocks->first();

        return $stock === null ? '0.000000' : $stock->quantity;
    }
}
