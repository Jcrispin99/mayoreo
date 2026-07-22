<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\ProductPurchaseUnit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ProductPurchaseUnit
 */
final class ProductPurchaseUnitResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'name' => $this->name,
            'conversion_factor' => $this->conversion_factor,
            'barcode' => $this->barcode,
            'is_default_purchase' => $this->is_default_purchase,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
