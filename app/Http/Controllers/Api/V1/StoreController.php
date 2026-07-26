<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\LocationOperationException;
use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\StoreStoreRequest;
use App\Http\Requests\Api\V1\UpdateStoreRequest;
use App\Http\Resources\StoreResource;
use App\Models\Store;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class StoreController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $stores = Store::query()
            ->with(['warehouses' => function (Relation $relation): void {
                $relation->getQuery()->orderByDesc('is_default')->orderBy('name');
            }])
            ->when($request->filled('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy('name')
            ->get();

        return $this->success(StoreResource::collection($stores));
    }

    public function store(StoreStoreRequest $request): JsonResponse
    {
        $store = DB::transaction(function () use ($request): Store {
            $store = Store::query()->create($request->validated());
            $store->warehouses()->create([
                'code' => mb_strtoupper($store->code).'-PRINCIPAL',
                'name' => 'Almacén principal - '.$store->name,
                'type' => 'retail',
                'is_default' => true,
                'is_active' => true,
            ]);

            return $store;
        });

        $store->load('warehouses');

        return $this->created(new StoreResource($store));
    }

    public function show(Store $store): JsonResponse
    {
        $store->load(['warehouses' => function (Relation $relation): void {
            $relation->getQuery()->orderByDesc('is_default')->orderBy('name');
        }]);

        return $this->success(new StoreResource($store));
    }

    public function update(UpdateStoreRequest $request, Store $store): JsonResponse
    {
        $attributes = $request->validated();

        if (array_key_exists('fiscal_issuer_id', $attributes)
            && $attributes['fiscal_issuer_id'] === null) {
            $attributes['sunat_establishment_code'] = null;
            $attributes['sunat_address'] = null;
            $attributes['sunat_ubigeo'] = null;
            $attributes['sunat_urbanization'] = null;
            $attributes['sunat_department'] = null;
            $attributes['sunat_province'] = null;
            $attributes['sunat_district'] = null;
        }

        $store->update($attributes);
        $store->load('warehouses');

        return $this->success(new StoreResource($store), 'Tienda actualizada');
    }

    public function destroy(Store $store): JsonResponse
    {
        $warehouseIds = $store->warehouses()->pluck('id');
        $inUse = DB::table('stocks')->whereIn('warehouse_id', $warehouseIds)->exists()
            || DB::table('inventory_movements')->whereIn('warehouse_id', $warehouseIds)->exists()
            || DB::table('purchase_orders')->whereIn('warehouse_id', $warehouseIds)->exists()
            || DB::table('sales')->whereIn('warehouse_id', $warehouseIds)->exists()
            || DB::table('inventory_transfers')->whereIn('from_warehouse_id', $warehouseIds)->exists()
            || DB::table('inventory_transfers')->whereIn('to_warehouse_id', $warehouseIds)->exists();

        if ($inUse) {
            throw LocationOperationException::storeInUse();
        }

        DB::transaction(function () use ($store): void {
            $store->warehouses()->delete();
            $store->delete();
        });

        return $this->noContent();
    }
}
