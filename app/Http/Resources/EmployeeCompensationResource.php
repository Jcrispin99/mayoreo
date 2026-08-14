<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\EmployeeCompensation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin EmployeeCompensation */
final class EmployeeCompensationResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'pay_type' => $this->pay_type,
            'amount' => $this->amount,
            'effective_from' => $this->effective_from->toDateString(),
            'effective_to' => $this->effective_to?->toDateString(),
            'created_by' => $this->created_by,
            'notes' => $this->notes,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
