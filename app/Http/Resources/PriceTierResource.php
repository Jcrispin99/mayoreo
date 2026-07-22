<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\PriceTier;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PriceTier
 */
final class PriceTierResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'min_quantity' => $this->min_quantity,
            'max_quantity' => $this->max_quantity,
            'unit_price' => $this->unit_price,
            'label' => $this->label,
            'is_active' => $this->is_active,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
