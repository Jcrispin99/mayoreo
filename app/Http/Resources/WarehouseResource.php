<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Warehouse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Warehouse
 */
final class WarehouseResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'store_id' => $this->store_id,
            'store' => $this->whenLoaded('store', function (): ?array {
                $store = $this->store;
                if ($store === null) {
                    return null;
                }

                return ['id' => $store->id, 'code' => $store->code, 'name' => $store->name];
            }),
            'code' => $this->code,
            'name' => $this->name,
            'type' => $this->type,
            'is_active' => $this->is_active,
            'is_default' => $this->is_default,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
