<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\SaveSpecialDayRequest;
use App\Http\Resources\SpecialDayResource;
use App\Models\SpecialDay;
use Illuminate\Http\JsonResponse;

final class SpecialDayController extends ApiController
{
    public function index(): JsonResponse
    {
        return $this->success(SpecialDayResource::collection(SpecialDay::query()->orderByDesc('date')->get()));
    }

    public function store(SaveSpecialDayRequest $request): JsonResponse
    {
        $specialDay = SpecialDay::query()->create([
            ...$request->validated(),
            'created_by' => $request->user()?->id,
        ]);

        return $this->created(new SpecialDayResource($specialDay), 'Día especial creado');
    }

    public function update(SaveSpecialDayRequest $request, SpecialDay $specialDay): JsonResponse
    {
        $specialDay->update($request->validated());

        return $this->success(new SpecialDayResource($specialDay->fresh()), 'Día especial actualizado');
    }

    public function destroy(SpecialDay $specialDay): JsonResponse
    {
        $specialDay->delete();

        return $this->success(null, 'Día especial eliminado');
    }
}
