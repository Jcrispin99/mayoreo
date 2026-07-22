<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\ApiController;
use App\Http\Resources\InventoryMovementResource;
use App\Models\InventoryMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class InventoryMovementController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $movements = InventoryMovement::query()
            ->with(['product.baseUnit', 'warehouse'])
            ->when($request->filled('product_id'), fn ($query) => $query->where('product_id', $request->integer('product_id')))
            ->when($request->filled('warehouse_id'), fn ($query) => $query->where('warehouse_id', $request->integer('warehouse_id')))
            ->when($request->filled('type'), fn ($query) => $query->where('type', $request->string('type')))
            ->when($request->string('flow')->toString() === 'in', fn ($query) => $query->where(function ($inner): void {
                $inner->whereIn('type', ['purchase', 'transfer_in'])
                    ->orWhere(fn ($adjustment) => $adjustment->where('type', 'adjustment')->where('direction', 'increase'));
            }))
            ->when($request->string('flow')->toString() === 'out', fn ($query) => $query->where(function ($inner): void {
                $inner->whereIn('type', ['sale', 'transfer_out'])
                    ->orWhere(fn ($adjustment) => $adjustment->where('type', 'adjustment')->where('direction', 'decrease'));
            }))
            ->orderByDesc('id')
            ->get();

        return $this->success(InventoryMovementResource::collection($movements));
    }
}
