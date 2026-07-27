<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\PosOrder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin PosOrder */
final class PosOrderResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'cash_register_session_id' => $this->cash_register_session_id,
            'number' => $this->number,
            'status' => $this->status,
            'subtotal' => $this->subtotal,
            'total' => $this->total,
            'item_count' => $this->whenLoaded('items', fn (): int => $this->items->count()),
            'items' => PosOrderItemResource::collection($this->whenLoaded('items')),
            'supply_requests' => InventoryTransferResource::collection($this->whenLoaded('supplyRequests')),
            'created_by' => $this->created_by,
            'completed_by' => $this->completed_by,
            'completer' => new UserResource($this->whenLoaded('completer')),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
