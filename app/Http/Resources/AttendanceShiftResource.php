<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\AttendanceShift;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin AttendanceShift */
final class AttendanceShiftResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'employee_profile_id' => $this->employee_profile_id,
            'employee' => new EmployeeProfileResource($this->whenLoaded('employeeProfile')),
            'store_id' => $this->store_id,
            'store' => new StoreResource($this->whenLoaded('store')),
            'clocked_in_at' => $this->clocked_in_at->toIso8601String(),
            'clocked_out_at' => $this->clocked_out_at?->toIso8601String(),
            'worked_minutes' => $this->worked_minutes,
            'status' => $this->status,
            'source' => $this->source,
            'adjustments' => AttendanceAdjustmentResource::collection($this->whenLoaded('adjustments')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
