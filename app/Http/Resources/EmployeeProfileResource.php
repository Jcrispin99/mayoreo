<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\EmployeeProfile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin EmployeeProfile */
final class EmployeeProfileResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'user' => new UserResource($this->whenLoaded('user')),
            'store_id' => $this->store_id,
            'store' => new StoreResource($this->whenLoaded('store')),
            'employment_status' => $this->employment_status,
            'hired_at' => $this->hired_at->toDateString(),
            'terminated_at' => $this->terminated_at?->toDateString(),
            'expected_minutes_per_day' => $this->expected_minutes_per_day,
            'monthly_divisor' => $this->monthly_divisor,
            'work_days' => $this->work_days,
            'compensations' => EmployeeCompensationResource::collection($this->whenLoaded('compensations')),
            'current_shift' => new AttendanceShiftResource($this->whenLoaded('currentShift')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
