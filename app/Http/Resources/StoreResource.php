<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Store
 */
final class StoreResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'fiscal_issuer_id' => $this->fiscal_issuer_id,
            'code' => $this->code,
            'name' => $this->name,
            'address' => $this->address,
            'phone' => $this->phone,
            'sunat_establishment_code' => $this->sunat_establishment_code,
            'sunat_address' => $this->sunat_address,
            'sunat_ubigeo' => $this->sunat_ubigeo,
            'sunat_urbanization' => $this->sunat_urbanization,
            'sunat_department' => $this->sunat_department,
            'sunat_province' => $this->sunat_province,
            'sunat_district' => $this->sunat_district,
            'is_active' => $this->is_active,
            'warehouses' => WarehouseResource::collection($this->whenLoaded('warehouses')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
