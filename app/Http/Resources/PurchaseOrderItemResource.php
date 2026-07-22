<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Productable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Productable
 */
final class PurchaseOrderItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'product_purchase_unit_id' => $this->product_purchase_unit_id,
            'quantity_purchased' => $this->quantity_purchased,
            'quantity_base' => $this->quantity,
            'unit_cost' => $this->unit_cost,
        ];
    }
}
