<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Inventory\AdjustStockAction;
use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\StoreStockAdjustmentRequest;
use App\Http\Resources\InventoryMovementResource;
use App\Http\Resources\StockResource;
use App\Models\Product;
use App\Models\Stock;
use App\Models\Warehouse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class StockController extends ApiController
{
    public function __construct(
        private readonly AdjustStockAction $adjustStockAction,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $stocks = Stock::query()
            ->with(['warehouse', 'product'])
            ->when($request->filled('warehouse_id'), fn ($query) => $query->where('warehouse_id', $request->integer('warehouse_id')))
            ->when($request->filled('product_id'), fn ($query) => $query->where('product_id', $request->integer('product_id')))
            ->get();

        return $this->success(StockResource::collection($stocks));
    }

    public function adjust(StoreStockAdjustmentRequest $request): JsonResponse
    {
        $product = Product::query()->findOrFail($request->integer('product_id'));
        $warehouse = Warehouse::query()->findOrFail($request->integer('warehouse_id'));

        $movement = $this->adjustStockAction->execute(
            $product,
            $warehouse,
            $request->string('direction')->toString(),
            (string) $request->float('quantity'),
            $request->filled('unit_cost') ? (string) $request->float('unit_cost') : null,
            $request->string('notes')->toString() ?: null,
            $request->user()?->id,
        );

        return $this->created(new InventoryMovementResource($movement), 'Stock adjusted successfully');
    }
}
