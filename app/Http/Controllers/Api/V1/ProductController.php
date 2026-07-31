<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\StoreProductRequest;
use App\Http\Requests\Api\V1\UpdateProductRequest;
use App\Http\Requests\Api\V1\UploadProductImageRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Models\ProductTemplate;
use App\Services\ProductVariantIdentityGuard;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

final class ProductController extends ApiController
{
    public function __construct(
        private readonly ProductVariantIdentityGuard $productVariantIdentityGuard,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $products = Product::query()
            ->with([
                'baseUnit',
                'contentUnit',
                'template',
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
        $product = DB::transaction(function () use ($request): Product {
            $values = $request->validated();

            if (! isset($values['product_template_id'])) {
                $template = ProductTemplate::query()->create([
                    'name' => $values['name'],
                    'description' => $values['description'] ?? null,
                    'is_active' => $values['is_active'] ?? true,
                    'is_pos_visible' => true,
                ]);
                $values['product_template_id'] = $template->id;
                $values['is_principal'] = true;

                return Product::query()->create($values);
            }

            /** @var ProductTemplate $template */
            $template = ProductTemplate::query()
                ->lockForUpdate()
                ->findOrFail($values['product_template_id']);
            $hasPrincipal = $template->variants()->where('is_principal', true)->exists();

            if ($hasPrincipal && (bool) ($values['is_principal'] ?? false)) {
                throw ValidationException::withMessages([
                    'is_principal' => 'Este producto ya tiene una variante principal.',
                ]);
            }

            $values['is_principal'] = ! $hasPrincipal;

            return Product::query()->create($values);
        })->refresh();
        $product->load(['baseUnit', 'contentUnit', 'template']);

        return $this->created(new ProductResource($product));
    }

    public function show(Product $product): JsonResponse
    {
        $product->load(['baseUnit', 'contentUnit', 'template', 'purchaseUnits', 'priceTiers']);

        return $this->success(new ProductResource($product));
    }

    public function update(UpdateProductRequest $request, Product $product): JsonResponse
    {
        $values = $request->validated();

        if (array_key_exists('product_template_id', $values)) {
            $requestedTemplateId = is_numeric($values['product_template_id'])
                ? (int) $values['product_template_id']
                : null;

            if ($requestedTemplateId !== $product->product_template_id) {
                throw ValidationException::withMessages([
                    'product_template_id' => 'La variante no puede trasladarse a otro producto.',
                ]);
            }
        }

        if (
            array_key_exists('is_principal', $values)
            && (bool) $values['is_principal'] !== $product->is_principal
        ) {
            throw ValidationException::withMessages([
                'is_principal' => 'La variante principal solo se administra desde el producto.',
            ]);
        }

        $this->productVariantIdentityGuard->assertMeasurementIdentityCanChange($product, $values);
        $product->update($values);
        $product->load(['baseUnit', 'contentUnit', 'template']);

        return $this->success(new ProductResource($product), 'Product updated successfully');
    }

    public function destroy(Product $product): JsonResponse
    {
        if ($product->is_principal) {
            throw ValidationException::withMessages([
                'product' => 'La variante principal no puede eliminarse.',
            ]);
        }

        $product->delete();

        return $this->noContent();
    }

    public function uploadImage(UploadProductImageRequest $request, Product $product): JsonResponse
    {
        $product->loadMissing('template');
        $oldPaths = collect([$product->image_path]);
        if ($product->is_principal) {
            $oldPaths->push($product->template?->image_path);
        }

        foreach ($oldPaths->filter()->unique() as $oldPath) {
            Storage::disk('public')->delete((string) $oldPath);
        }

        $path = $request->file('image')->store('products', 'public');

        $product->update(['image_path' => $path]);
        if ($product->is_principal) {
            $product->template?->update(['image_path' => $path]);
        }
        $product->load(['baseUnit', 'contentUnit', 'template']);

        return $this->success(new ProductResource($product), 'Product image uploaded successfully');
    }
}
