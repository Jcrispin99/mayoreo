<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\InventoryMovement;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin InventoryMovement
 */
final class InventoryMovementResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'product' => $this->whenLoaded('product', fn (): array => [
                'id' => $this->product->id,
                'sku' => $this->product->sku,
                'name' => $this->product->name,
                'base_unit' => $this->product->baseUnit ? [
                    'id' => $this->product->baseUnit->id,
                    'code' => $this->product->baseUnit->code,
                    'name' => $this->product->baseUnit->name,
                ] : null,
            ]),
            'warehouse_id' => $this->warehouse_id,
            'warehouse' => $this->whenLoaded('warehouse', fn (): array => [
                'id' => $this->warehouse->id,
                'code' => $this->warehouse->code,
                'name' => $this->warehouse->name,
            ]),
            'type' => $this->type,
            'flow' => $this->type === 'adjustment'
                ? ($this->direction === 'increase' ? 'in' : 'out')
                : (in_array($this->type, ['purchase', 'transfer_in'], true) ? 'in' : 'out'),
            'quantity' => $this->quantity,
            'direction' => $this->direction,
            'unit_cost' => $this->unit_cost,
            'balance_quantity' => $this->balance_quantity,
            'balance_unit_cost' => $this->balance_unit_cost,
            'balance_total_cost' => $this->balance_total_cost,
            'reference_type' => $this->reference_type,
            'reference_id' => $this->reference_id,
            'notes' => $this->notes,
            'created_by' => $this->created_by,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
