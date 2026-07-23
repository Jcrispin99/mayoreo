<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\CashRegisterSession;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin CashRegisterSession */
final class CashRegisterSessionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'cash_register_id' => $this->cash_register_id,
            'cash_register' => new CashRegisterResource($this->whenLoaded('cashRegister')),
            'status' => $this->status,
            'opening_amount' => $this->opening_amount,
            'income_total' => $this->incomeTotal(),
            'expense_total' => $this->expenseTotal(),
            'expected_amount' => $this->status === 'closed' ? $this->expected_amount : $this->liveExpectedAmount(),
            'counted_amount' => $this->counted_amount,
            'difference_amount' => $this->difference_amount,
            'opening_notes' => $this->opening_notes,
            'closing_notes' => $this->closing_notes,
            'opened_by' => $this->opened_by,
            'opener' => new UserResource($this->whenLoaded('opener')),
            'closed_by' => $this->closed_by,
            'closer' => new UserResource($this->whenLoaded('closer')),
            'opened_at' => $this->opened_at->toIso8601String(),
            'closed_at' => $this->closed_at?->toIso8601String(),
            'movements' => CashRegisterMovementResource::collection($this->whenLoaded('movements')),
        ];
    }
}
