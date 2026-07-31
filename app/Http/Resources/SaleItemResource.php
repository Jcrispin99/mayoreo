<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Productable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Productable
 */
final class SaleItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'stock_product_id' => $this->stock_product_id,
            'quantity' => $this->quantity,
            'stock_quantity' => $this->stock_quantity,
            'input_quantity' => $this->input_quantity,
            'input_unit_id' => $this->input_unit_id,
            'price_tier_id' => $this->price_tier_id,
            'unit_price' => $this->unit_price,
            'line_total' => $this->line_total,
            'product' => new ProductResource($this->whenLoaded('product')),
            'stock_product' => new ProductResource($this->whenLoaded('stockProduct')),
            'input_unit' => new UnitOfMeasureResource($this->whenLoaded('inputUnit')),
            'price_tier' => new PriceTierResource($this->whenLoaded('priceTier')),
        ];
    }
}
