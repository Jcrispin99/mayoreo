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
            'quantity' => $this->quantity,
            'input_quantity' => $this->input_quantity,
            'input_unit_id' => $this->input_unit_id,
            'price_tier_id' => $this->price_tier_id,
            'unit_price' => $this->unit_price,
            'line_total' => $this->line_total,
        ];
    }
}
