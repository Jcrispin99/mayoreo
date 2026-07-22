<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\LocationOperationException;
use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\StoreUnitOfMeasureRequest;
use App\Http\Requests\Api\V1\UpdateUnitOfMeasureRequest;
use App\Http\Resources\UnitOfMeasureResource;
use App\Models\UnitOfMeasure;
use Illuminate\Http\JsonResponse;

final class UnitOfMeasureController extends ApiController
{
    public function index(): JsonResponse
    {
        $units = UnitOfMeasure::query()->orderBy('code')->get();

        return $this->success(UnitOfMeasureResource::collection($units));
    }

    public function store(StoreUnitOfMeasureRequest $request): JsonResponse
    {
        $unit = UnitOfMeasure::query()->create($request->validated());

        return $this->created(new UnitOfMeasureResource($unit));
    }

    public function show(UnitOfMeasure $unitOfMeasure): JsonResponse
    {
        return $this->success(new UnitOfMeasureResource($unitOfMeasure));
    }

    public function update(UpdateUnitOfMeasureRequest $request, UnitOfMeasure $unitOfMeasure): JsonResponse
    {
        $unitOfMeasure->update($request->validated());

        return $this->success(new UnitOfMeasureResource($unitOfMeasure), 'Unit of measure updated successfully');
    }

    public function destroy(UnitOfMeasure $unitOfMeasure): JsonResponse
    {
        if ($unitOfMeasure->products()->exists() || $unitOfMeasure->saleItems()->exists()) {
            throw LocationOperationException::unitInUse();
        }

        $unitOfMeasure->delete();

        return $this->noContent();
    }
}
