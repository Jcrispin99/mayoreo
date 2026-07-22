<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Sale;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Sale
 */
final class SaleResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'warehouse_id' => $this->warehouse_id,
            'customer_name' => $this->customer_name,
            'customer_document' => $this->customer_document,
            'status' => $this->status,
            'subtotal' => $this->subtotal,
            'total' => $this->total,
            'sold_at' => $this->sold_at?->toIso8601String(),
            'items' => SaleItemResource::collection($this->whenLoaded('items')),
            'fiscal_documents' => FiscalDocumentResource::collection($this->whenLoaded('fiscalDocuments')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
