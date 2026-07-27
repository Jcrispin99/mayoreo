<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Product;
use App\Models\Productable;
use App\Models\UnitOfMeasure;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Productable
 */
final class InventoryTransferItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'product' => $this->whenLoaded('product', function (): ?array {
                $product = $this->product;

                if (! $product instanceof Product) {
                    return null;
                }

                $baseUnit = $product->baseUnit;

                return [
                    'id' => $product->id,
                    'sku' => $product->sku,
                    'name' => $product->name,
                    'base_unit' => $baseUnit instanceof UnitOfMeasure ? [
                        'id' => $baseUnit->id,
                        'code' => $baseUnit->code,
                        'name' => $baseUnit->name,
                        'type' => $baseUnit->type,
                    ] : null,
                ];
            }),
            'quantity' => $this->quantity,
            'unit_cost' => $this->unit_cost,
        ];
    }
}
