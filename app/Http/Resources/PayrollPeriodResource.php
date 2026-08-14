<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\PayrollPeriod;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin PayrollPeriod */
final class PayrollPeriodResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'starts_on' => $this->starts_on->toDateString(),
            'ends_on' => $this->ends_on->toDateString(),
            'status' => $this->status,
            'created_by' => $this->created_by,
            'closed_by' => $this->closed_by,
            'closed_at' => $this->closed_at?->toIso8601String(),
            'lines' => PayrollLineResource::collection($this->whenLoaded('lines')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
