<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\SaveCashRegisterRequest;
use App\Http\Resources\CashRegisterResource;
use App\Models\CashRegister;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class CashRegisterController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $cashRegisters = CashRegister::query()
            ->with(['store', 'warehouse.store', 'salesSeries', 'defaultSalesSeries'])
            ->when($request->filled('store_id'), fn ($query) => $query->where('store_id', $request->integer('store_id')))
            ->when($request->filled('warehouse_id'), fn ($query) => $query->where('warehouse_id', $request->integer('warehouse_id')))
            ->when($request->filled('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy('code')
            ->get();

        return $this->success(CashRegisterResource::collection($cashRegisters));
    }

    public function store(SaveCashRegisterRequest $request): JsonResponse
    {
        $cashRegister = DB::transaction(function () use ($request): CashRegister {
            $data = $request->validated();
            unset($data['sales_series_ids']);
            $cashRegister = CashRegister::query()->create($data);
            $cashRegister->salesSeries()->sync($request->salesSeriesIds());

            return $cashRegister;
        });

        return $this->created(new CashRegisterResource($this->loadRelations($cashRegister)));
    }

    public function show(CashRegister $cashRegister): JsonResponse
    {
        return $this->success(new CashRegisterResource($this->loadRelations($cashRegister)));
    }

    public function update(SaveCashRegisterRequest $request, CashRegister $cashRegister): JsonResponse
    {
        DB::transaction(function () use ($request, $cashRegister): void {
            $data = $request->validated();
            unset($data['sales_series_ids']);
            $cashRegister->update($data);
            $cashRegister->salesSeries()->sync($request->salesSeriesIds());
        });

        return $this->success(new CashRegisterResource($this->loadRelations($cashRegister)), 'Caja actualizada');
    }

    private function loadRelations(CashRegister $cashRegister): CashRegister
    {
        return $cashRegister->fresh([
            'store',
            'warehouse.store',
            'salesSeries',
            'defaultSalesSeries',
        ]) ?? $cashRegister;
    }
}
