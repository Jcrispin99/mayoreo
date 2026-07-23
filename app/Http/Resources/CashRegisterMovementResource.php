<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\CashRegisterMovement;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin CashRegisterMovement */
final class CashRegisterMovementResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'cash_register_session_id' => $this->cash_register_session_id,
            'type' => $this->type,
            'amount' => $this->amount,
            'reason' => $this->reason,
            'notes' => $this->notes,
            'created_by' => $this->created_by,
            'creator' => new UserResource($this->whenLoaded('creator')),
            'occurred_at' => $this->occurred_at->toIso8601String(),
        ];
    }
}
