<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Stock;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Stock
 */
final class StockResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'warehouse_id' => $this->warehouse_id,
            'warehouse' => new WarehouseResource($this->whenLoaded('warehouse')),
            'product_id' => $this->product_id,
            'product' => new ProductResource($this->whenLoaded('product')),
            'quantity' => $this->quantity,
            'average_cost' => $this->average_cost,
            'total_cost' => $this->total_cost,
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
