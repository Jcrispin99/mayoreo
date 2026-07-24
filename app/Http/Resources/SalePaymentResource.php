<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\SalePayment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin SalePayment */
final class SalePaymentResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'sale_id' => $this->sale_id,
            'cash_register_session_id' => $this->cash_register_session_id,
            'method' => $this->method,
            'amount' => $this->amount,
            'received_amount' => $this->received_amount,
            'change_amount' => $this->change_amount,
            'reference' => $this->reference,
            'status' => $this->status,
            'paid_at' => $this->paid_at->toIso8601String(),
            'created_by' => $this->created_by,
            'creator' => new UserResource($this->whenLoaded('creator')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
