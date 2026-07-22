<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\PurchaseOrder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PurchaseOrder
 */
final class PurchaseOrderResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'series_code' => $this->series_code,
            'number' => $this->number,
            'full_number' => $this->series_code && $this->number
                ? sprintf('%s-%08d', $this->series_code, $this->number)
                : null,
            'supplier_id' => $this->supplier_id,
            'warehouse_id' => $this->warehouse_id,
            'status' => $this->status,
            'ordered_at' => $this->ordered_at?->toDateString(),
            'invoice_series' => $this->invoice_series,
            'invoice_number' => $this->invoice_number,
            'invoice_full_number' => $this->invoice_series && $this->invoice_number
                ? "{$this->invoice_series}-{$this->invoice_number}"
                : null,
            'total' => $this->total,
            'received_at' => $this->received_at?->toIso8601String(),
            'notes' => $this->notes,
            'items' => PurchaseOrderItemResource::collection($this->whenLoaded('items')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
