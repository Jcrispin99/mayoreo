<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\StoreProductRequest;
use App\Http\Requests\Api\V1\UpdateProductRequest;
use App\Http\Requests\Api\V1\UploadProductImageRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

final class ProductController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $products = Product::query()
            ->with([
                'baseUnit',
                'priceTiers' => function (Relation $relation): void {
                    $relation->getQuery()->where('is_active', true)->orderBy('min_quantity');
                },
            ])
            ->when($request->filled('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->when($request->filled('search'), fn ($query) => $query->where(function ($inner) use ($request): void {
                $inner->where('name', 'like', "%{$request->string('search')}%")
                    ->orWhere('sku', 'like', "%{$request->string('search')}%");
            }))
            ->orderBy('name')
            ->get();

        return $this->success(ProductResource::collection($products));
    }

    public function store(StoreProductRequest $request): JsonResponse
    {
        $product = Product::query()->create($request->validated())->refresh();
        $product->load('baseUnit');

        return $this->created(new ProductResource($product));
    }

    public function show(Product $product): JsonResponse
    {
        $product->load(['baseUnit', 'purchaseUnits', 'priceTiers']);

        return $this->success(new ProductResource($product));
    }

    public function update(UpdateProductRequest $request, Product $product): JsonResponse
    {
        $product->update($request->validated());
        $product->load('baseUnit');

        return $this->success(new ProductResource($product), 'Product updated successfully');
    }

    public function destroy(Product $product): JsonResponse
    {
        $product->delete();

        return $this->noContent();
    }

    public function uploadImage(UploadProductImageRequest $request, Product $product): JsonResponse
    {
        if ($product->image_path) {
            Storage::disk('public')->delete($product->image_path);
        }

        $path = $request->file('image')->store('products', 'public');

        $product->update(['image_path' => $path]);
        $product->load('baseUnit');

        return $this->success(new ProductResource($product), 'Product image uploaded successfully');
    }
}
