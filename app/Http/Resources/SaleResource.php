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
            'cash_register_session_id' => $this->cash_register_session_id,
            'pos_order_id' => $this->pos_order_id,
            'customer_id' => $this->customer_id,
            'source' => $this->source,
            'customer_name' => $this->customer_name,
            'customer_document' => $this->customer_document,
            'notes' => $this->notes,
            'status' => $this->status,
            'subtotal' => $this->subtotal,
            'total' => $this->total,
            'payable_total' => $this->payable_total,
            'sold_at' => $this->sold_at->toIso8601String(),
            'warehouse' => new WarehouseResource($this->whenLoaded('warehouse')),
            'customer' => new CustomerResource($this->whenLoaded('customer')),
            'creator' => new UserResource($this->whenLoaded('creator')),
            'items' => SaleItemResource::collection($this->whenLoaded('items')),
            'payments' => SalePaymentResource::collection($this->whenLoaded('payments')),
            'fiscal_documents' => FiscalDocumentResource::collection($this->whenLoaded('fiscalDocuments')),
            'primary_document' => $this->whenLoaded(
                'fiscalDocuments',
                fn (): ?FiscalDocumentResource => $this->fiscalDocuments->isEmpty()
                    ? null
                    : new FiscalDocumentResource($this->fiscalDocuments->first()),
            ),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
