<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\LocationOperationException;
use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\StoreWarehouseRequest;
use App\Http\Requests\Api\V1\UpdateWarehouseRequest;
use App\Http\Resources\WarehouseResource;
use App\Models\Warehouse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class WarehouseController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $warehouses = Warehouse::query()
            ->with('store')
            ->when($request->filled('store_id'), fn ($query) => $query->where('store_id', $request->integer('store_id')))
            ->when($request->filled('type'), fn ($query) => $query->where('type', $request->string('type')))
            ->when($request->filled('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy('code')
            ->get();

        return $this->success(WarehouseResource::collection($warehouses));
    }

    public function store(StoreWarehouseRequest $request): JsonResponse
    {
        $data = $request->validated();
        $makeDefault = $request->boolean('is_default')
            || ! Warehouse::query()->where('store_id', $request->integer('store_id'))->exists();

        $warehouse = DB::transaction(function () use ($data, $makeDefault): Warehouse {
            if ($makeDefault) {
                Warehouse::query()->where('store_id', $data['store_id'])->update(['is_default' => false]);
            }

            return Warehouse::query()->create([
                ...$data,
                'type' => $data['type'] ?? 'retail',
                'is_default' => $makeDefault,
            ]);
        });

        $warehouse->load('store');

        return $this->created(new WarehouseResource($warehouse));
    }

    public function show(Warehouse $warehouse): JsonResponse
    {
        $warehouse->load('store');

        return $this->success(new WarehouseResource($warehouse));
    }

    public function update(UpdateWarehouseRequest $request, Warehouse $warehouse): JsonResponse
    {
        $data = $request->validated();

        if ($warehouse->is_default && (
            (array_key_exists('is_active', $data) && ! $data['is_active'])
            || (array_key_exists('is_default', $data) && ! $data['is_default'])
        )) {
            throw LocationOperationException::defaultWarehouse();
        }

        DB::transaction(function () use ($data, $warehouse): void {
            if (($data['is_default'] ?? false) === true) {
                Warehouse::query()
                    ->where('store_id', $warehouse->store_id)
                    ->whereKeyNot($warehouse->id)
                    ->update(['is_default' => false]);
                $data['is_active'] = true;
            }

            $warehouse->update($data);
        });

        $warehouse->load('store');

        return $this->success(new WarehouseResource($warehouse), 'Warehouse updated successfully');
    }

    public function destroy(Warehouse $warehouse): JsonResponse
    {
        if ($warehouse->is_default) {
            throw LocationOperationException::defaultWarehouse();
        }

        $inUse = DB::table('stocks')->where('warehouse_id', $warehouse->id)->exists()
            || DB::table('inventory_movements')->where('warehouse_id', $warehouse->id)->exists()
            || DB::table('purchase_orders')->where('warehouse_id', $warehouse->id)->exists()
            || DB::table('sales')->where('warehouse_id', $warehouse->id)->exists()
            || DB::table('inventory_transfers')->where('from_warehouse_id', $warehouse->id)->exists()
            || DB::table('inventory_transfers')->where('to_warehouse_id', $warehouse->id)->exists();

        if ($inUse) {
            throw LocationOperationException::warehouseInUse();
        }

        $warehouse->delete();

        return $this->noContent();
    }
}
