<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\StoreSupplierRequest;
use App\Http\Requests\Api\V1\UpdateSupplierRequest;
use App\Http\Resources\SupplierResource;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;

final class SupplierController extends ApiController
{
    public function index(): JsonResponse
    {
        return $this->success(SupplierResource::collection(Supplier::query()->orderBy('name')->get()));
    }

    public function store(StoreSupplierRequest $request): JsonResponse
    {
        $supplier = Supplier::query()->create($request->validated())->refresh();

        return $this->created(new SupplierResource($supplier));
    }

    public function show(Supplier $supplier): JsonResponse
    {
        return $this->success(new SupplierResource($supplier));
    }

    public function update(UpdateSupplierRequest $request, Supplier $supplier): JsonResponse
    {
        $supplier->update($request->validated());

        return $this->success(new SupplierResource($supplier), 'Supplier updated successfully');
    }

    public function destroy(Supplier $supplier): JsonResponse
    {
        $supplier->delete();

        return $this->noContent();
    }
}
