<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\StoreProductPurchaseUnitRequest;
use App\Http\Requests\Api\V1\UpdateProductPurchaseUnitRequest;
use App\Http\Resources\ProductPurchaseUnitResource;
use App\Models\Product;
use App\Models\ProductPurchaseUnit;
use Illuminate\Http\JsonResponse;

final class ProductPurchaseUnitController extends ApiController
{
    public function index(Product $product): JsonResponse
    {
        return $this->success(ProductPurchaseUnitResource::collection($product->purchaseUnits));
    }

    public function store(StoreProductPurchaseUnitRequest $request, Product $product): JsonResponse
    {
        $purchaseUnit = $product->purchaseUnits()->create($request->validated())->refresh();

        return $this->created(new ProductPurchaseUnitResource($purchaseUnit));
    }

    public function show(ProductPurchaseUnit $purchaseUnit): JsonResponse
    {
        return $this->success(new ProductPurchaseUnitResource($purchaseUnit));
    }

    public function update(UpdateProductPurchaseUnitRequest $request, ProductPurchaseUnit $purchaseUnit): JsonResponse
    {
        $purchaseUnit->update($request->validated());

        return $this->success(new ProductPurchaseUnitResource($purchaseUnit), 'Purchase unit updated successfully');
    }

    public function destroy(ProductPurchaseUnit $purchaseUnit): JsonResponse
    {
        $purchaseUnit->delete();

        return $this->noContent();
    }
}
