<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Pricing\ValidatePriceTierRangeAction;
use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\StorePriceTierRequest;
use App\Http\Requests\Api\V1\UpdatePriceTierRequest;
use App\Http\Resources\PriceTierResource;
use App\Models\PriceTier;
use App\Models\Product;
use Illuminate\Http\JsonResponse;

final class PriceTierController extends ApiController
{
    public function __construct(
        private readonly ValidatePriceTierRangeAction $validatePriceTierRangeAction,
    ) {}

    public function index(Product $product): JsonResponse
    {
        return $this->success(PriceTierResource::collection($product->priceTiers()->orderBy('min_quantity')->get()));
    }

    public function store(StorePriceTierRequest $request, Product $product): JsonResponse
    {
        $this->validatePriceTierRangeAction->execute(
            $product,
            (string) $request->float('min_quantity'),
            $request->filled('max_quantity') ? (string) $request->float('max_quantity') : null,
        );

        $priceTier = $product->priceTiers()->create($request->validated())->refresh();

        return $this->created(new PriceTierResource($priceTier));
    }

    public function show(PriceTier $priceTier): JsonResponse
    {
        return $this->success(new PriceTierResource($priceTier));
    }

    public function update(UpdatePriceTierRequest $request, PriceTier $priceTier): JsonResponse
    {
        $minQuantity = $request->filled('min_quantity') ? (string) $request->float('min_quantity') : (string) $priceTier->min_quantity;
        $maxQuantity = $request->filled('max_quantity') ? (string) $request->float('max_quantity') : ($priceTier->max_quantity !== null ? (string) $priceTier->max_quantity : null);

        $this->validatePriceTierRangeAction->execute($priceTier->product, $minQuantity, $maxQuantity, $priceTier->id);

        $priceTier->update($request->validated());

        return $this->success(new PriceTierResource($priceTier), 'Price tier updated successfully');
    }

    public function destroy(PriceTier $priceTier): JsonResponse
    {
        $priceTier->delete();

        return $this->noContent();
    }
}
