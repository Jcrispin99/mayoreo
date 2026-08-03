<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\PosSupplyRequestItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin PosSupplyRequestItem */
final class PosSupplyRequestItemResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'product' => new ProductResource($this->whenLoaded('product')),
            'requested_quantity' => $this->requested_quantity,
            'prepared_quantity' => $this->prepared_quantity,
            'warehouse_notes' => $this->warehouse_notes,
            'change_type' => $this->change_type,
            'changed_version' => $this->changed_version,
            'prepared_by' => $this->prepared_by,
            'prepared_at' => $this->prepared_at?->toIso8601String(),
        ];
    }
}
