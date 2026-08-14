<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\SpecialDay;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin SpecialDay */
final class SpecialDayResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'date' => $this->date->toDateString(),
            'name' => $this->name,
            'bonus_percentage' => $this->bonus_percentage,
            'is_active' => $this->is_active,
        ];
    }
}
