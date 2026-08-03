<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\PosSupplyRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin PosSupplyRequest */
final class PosSupplyRequestResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'pos_order_id' => $this->pos_order_id,
            'pos_order_number' => $this->whenLoaded('posOrder', fn () => $this->posOrder?->number),
            'from_warehouse_id' => $this->from_warehouse_id,
            'to_warehouse_id' => $this->to_warehouse_id,
            'from_warehouse' => new WarehouseResource($this->whenLoaded('fromWarehouse')),
            'to_warehouse' => new WarehouseResource($this->whenLoaded('toWarehouse')),
            'assigned_to' => $this->assigned_to,
            'assignee' => $this->whenLoaded('assignee', fn () => $this->assignee === null ? null : [
                'id' => $this->assignee->id,
                'name' => $this->assignee->name,
            ]),
            'status' => $this->status,
            'warehouse_notes' => $this->warehouse_notes,
            'warehouse_notes_changed_version' => $this->warehouse_notes_changed_version,
            'version' => $this->version,
            'acknowledged_version' => $this->acknowledged_version,
            'has_unreviewed_changes' => $this->acknowledged_version < $this->version,
            'items' => PosSupplyRequestItemResource::collection($this->whenLoaded('items')),
            'inventory_transfer_id' => $this->inventory_transfer_id,
            'assigned_at' => $this->assigned_at?->toIso8601String(),
            'acknowledged_at' => $this->acknowledged_at?->toIso8601String(),
            'ready_at' => $this->ready_at?->toIso8601String(),
            'delivered_at' => $this->delivered_at?->toIso8601String(),
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
