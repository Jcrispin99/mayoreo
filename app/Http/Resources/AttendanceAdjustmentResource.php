<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\AttendanceAdjustment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin AttendanceAdjustment */
final class AttendanceAdjustmentResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'adjusted_by' => $this->adjusted_by,
            'adjuster' => new UserResource($this->whenLoaded('adjuster')),
            'previous_clocked_in_at' => $this->previous_clocked_in_at->toIso8601String(),
            'previous_clocked_out_at' => $this->previous_clocked_out_at?->toIso8601String(),
            'new_clocked_in_at' => $this->new_clocked_in_at->toIso8601String(),
            'new_clocked_out_at' => $this->new_clocked_out_at?->toIso8601String(),
            'reason' => $this->reason,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
