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
            'sku' => $this->sku,
            'barcode' => $this->barcode,
            'name' => $this->name,
            'image_url' => $this->image_url,
            'base_unit' => new UnitOfMeasureResource($this->whenLoaded('baseUnit')),
            'stock_available' => $this->availableStock(),
            'price_tiers' => PriceTierResource::collection($this->whenLoaded('priceTiers')),
            'is_favorite' => $this->is_favorite,
        ];
    }

    private function availableStock(): string
    {
        $stock = $this->stocks->first();

        return $stock === null ? '0.000000' : $stock->quantity;
    }
}
