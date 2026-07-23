<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\CashRegister;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin CashRegister */
final class CashRegisterResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'store_id' => $this->store_id,
            'store' => new StoreResource($this->whenLoaded('store')),
            'warehouse_id' => $this->warehouse_id,
            'warehouse' => new WarehouseResource($this->whenLoaded('warehouse')),
            'default_sales_series_id' => $this->default_sales_series_id,
            'default_sales_series' => new DocumentSeriesResource($this->whenLoaded('defaultSalesSeries')),
            'code' => $this->code,
            'name' => $this->name,
            'is_active' => $this->is_active,
            'sales_series' => DocumentSeriesResource::collection($this->whenLoaded('salesSeries')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
