<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\StoreProductTemplateRequest;
use App\Http\Requests\Api\V1\UpdateProductTemplateRequest;
use App\Http\Resources\ProductTemplateResource;
use App\Models\PriceTier;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductAttributeValue;
use App\Models\ProductTemplate;
use App\Models\UnitOfMeasure;
use App\Services\ProductVariantIdentityGuard;
use Closure;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class ProductTemplateController extends ApiController
{
    public function __construct(
        private readonly ProductVariantIdentityGuard $productVariantIdentityGuard,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $templates = ProductTemplate::query()
            ->with($this->relations())
            ->when($request->filled('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = (string) $request->string('search');
                $query->where(function ($inner) use ($search): void {
                    $inner->where('name', 'like', "%{$search}%")
                        ->orWhereHas('variants', function ($variants) use ($search): void {
                            $variants->where('sku', 'like', "%{$search}%")
                                ->orWhere('barcode', 'like', "%{$search}%")
                                ->orWhere('variant_name', 'like', "%{$search}%");
                        });
                });
            })
            ->orderBy('name')
            ->get();

        return $this->success(ProductTemplateResource::collection($templates));
    }

    public function store(StoreProductTemplateRequest $request): JsonResponse
    {
        $template = DB::transaction(function () use ($request): ProductTemplate {
            /** @var array<string, mixed> $attributes */
            $attributes = $request->safe()->except(['attributes', 'variants']);
            /** @var array<int, array{name: string, values: array<int, string>, value_prices?: array<string, mixed>, value_factors?: array<string, mixed>}> $attributeLines */
            $attributeLines = $request->array('attributes');
            /** @var array<int, array<string, mixed>> $variants */
            $variants = $request->array('variants');

            $template = ProductTemplate::query()->create($attributes);
            $definitions = $this->syncAttributes($template, $attributeLines);
            $this->syncVariants($template, $variants, $definitions);

            return $template;
        });

        return $this->created(new ProductTemplateResource($template->load($this->relations())));
    }

    public function show(ProductTemplate $productTemplate): JsonResponse
    {
        return $this->success(new ProductTemplateResource($productTemplate->load($this->relations())));
    }

    public function update(
        UpdateProductTemplateRequest $request,
        ProductTemplate $productTemplate,
    ): JsonResponse {
        DB::transaction(function () use ($request, $productTemplate): void {
            $lockedTemplate = ProductTemplate::query()
                ->lockForUpdate()
                ->findOrFail($productTemplate->id);
            /** @var array<string, mixed> $attributes */
            $attributes = $request->safe()->except(['attributes', 'variants']);
            /** @var array<int, array{name: string, values: array<int, string>, value_prices?: array<string, mixed>, value_factors?: array<string, mixed>}> $attributeLines */
            $attributeLines = $request->array('attributes');
            /** @var array<int, array<string, mixed>> $variants */
            $variants = $request->array('variants');

            $lockedTemplate->update($attributes);
            $definitions = $this->syncAttributes($lockedTemplate, $attributeLines);
            $this->syncVariants($lockedTemplate, $variants, $definitions);
        });

        return $this->success(
            new ProductTemplateResource($productTemplate->refresh()->load($this->relations())),
            'Product template updated successfully',
        );
    }

    /**
     * @param  array<int, array<string, mixed>>  $variants
     * @param  array<string, array{attribute: ProductAttribute, values: array<string, ProductAttributeValue>}>  $definitions
     */
    private function syncVariants(ProductTemplate $template, array $variants, array $definitions): void
    {
        $existingPrincipalId = $template->variants()
            ->where('is_principal', true)
            ->value('id');
        $existingPrincipalId = is_numeric($existingPrincipalId)
            ? (int) $existingPrincipalId
            : null;
        $principalAssigned = false;
        $processedIds = [];
        $signatures = [];

        foreach ($variants as $index => $variantData) {
            $variantId = $this->nullableInt($variantData['id'] ?? null);
            $variant = $variantId === null
                ? new Product()
                : $template->variants()->whereKey($variantId)->first();

            if (! $variant instanceof Product) {
                throw ValidationException::withMessages([
                    "variants.{$index}.id" => 'La variante no pertenece a este producto.',
                ]);
            }

            $variantName = isset($variantData['variant_name'])
                ? mb_trim($this->stringValue($variantData['variant_name']))
                : null;
            $requestedPrincipal = (bool) ($variantData['is_principal'] ?? false);
            if (
                $existingPrincipalId !== null
                && $requestedPrincipal
                && $variantId !== $existingPrincipalId
            ) {
                throw ValidationException::withMessages([
                    "variants.{$index}.is_principal" => 'La variante principal existente no puede ser reemplazada.',
                ]);
            }

            $isPrincipal = $existingPrincipalId !== null
                ? $variantId === $existingPrincipalId
                : ! $principalAssigned && ($requestedPrincipal || $index === 0);
            $principalAssigned = $principalAssigned || $isPrincipal;

            $baseUnit = UnitOfMeasure::query()->find($this->nullableInt($variantData['base_unit_id'] ?? null));
            $expectedSaleMode = $baseUnit?->code === 'kg' ? 'measured' : 'unit';
            if (($variantData['sale_mode'] ?? null) !== $expectedSaleMode) {
                throw ValidationException::withMessages([
                    "variants.{$index}.sale_mode" => $expectedSaleMode === 'measured'
                        ? 'Las variantes en kg deben venderse por peso.'
                        : 'Las variantes en Unidad deben venderse por unidad.',
                ]);
            }
            if (
                $expectedSaleMode === 'measured'
                && (! empty($variantData['content_quantity']) || ! empty($variantData['content_unit_id']))
            ) {
                throw ValidationException::withMessages([
                    "variants.{$index}.content_quantity" => 'Las variantes a granel en kg no llevan contenido de empaque.',
                ]);
            }

            $this->productVariantIdentityGuard->assertMeasurementIdentityCanChange(
                $variant,
                $variantData,
                "variants.{$index}.",
            );

            $variant->fill([
                'product_template_id' => $template->id,
                'sku' => $variantData['sku'],
                'barcode' => $variantData['barcode'] ?? null,
                'name' => $this->variantDisplayName($template->name, $variantName),
                'variant_name' => $variantName !== '' ? $variantName : null,
                'description' => $template->description,
                'base_unit_id' => $variantData['base_unit_id'],
                'sale_mode' => $variantData['sale_mode'],
                'content_quantity' => $variantData['content_quantity'] ?? null,
                'content_unit_id' => $variantData['content_unit_id'] ?? null,
                'is_active' => $variantData['is_active'] ?? true,
                'is_favorite' => $variantData['is_favorite'] ?? false,
                'is_principal' => $isPrincipal,
            ]);
            $variant->save();
            $processedIds[] = $variant->id;

            $signature = $this->syncVariantAttributeValues(
                $variant,
                $variantData,
                $definitions,
                $index,
                $isPrincipal,
            );
            if (isset($signatures[$signature])) {
                throw ValidationException::withMessages([
                    "variants.{$index}.attribute_values" => 'La combinación de atributos está duplicada.',
                ]);
            }
            $signatures[$signature] = true;

            if (isset($variantData['price_tiers']) && is_array($variantData['price_tiers'])) {
                /** @var array<int, array<string, mixed>> $priceTiers */
                $priceTiers = $variantData['price_tiers'];
                $this->syncPriceTiers($variant, $priceTiers, $index);
            } elseif (isset($variantData['base_price'])) {
                $this->syncBasePrice($variant, $this->stringValue($variantData['base_price']));
            }
        }

        if ($existingPrincipalId !== null && ! in_array($existingPrincipalId, $processedIds, true)) {
            throw ValidationException::withMessages([
                'variants' => 'La variante principal no puede eliminarse ni omitirse.',
            ]);
        }

        $template->variants()
            ->whereNotIn('id', $processedIds)
            ->update(['is_active' => false, 'is_principal' => false]);
    }

    /**
     * @param  array<int, array{name: string, values: array<int, string>, value_prices?: array<string, mixed>, value_factors?: array<string, mixed>}>  $attributeLines
     * @return array<string, array{attribute: ProductAttribute, values: array<string, ProductAttributeValue>}>
     */
    private function syncAttributes(ProductTemplate $template, array $attributeLines): array
    {
        $definitions = [];
        $templateValues = [];
        $position = 0;

        foreach ($attributeLines as $line) {
            $attributeName = mb_trim($line['name']);
            $attributeKey = $this->normalizedKey($attributeName);
            $valuePrices = $line['value_prices'] ?? [];
            $valueFactors = $line['value_factors'] ?? [];
            $attribute = ProductAttribute::query()
                ->whereRaw('LOWER(name) = ?', [$attributeKey])
                ->first();
            $attribute ??= ProductAttribute::query()->create([
                'name' => $attributeName,
                'is_active' => true,
            ]);

            $values = [];
            foreach ($line['values'] as $rawValue) {
                $valueName = mb_trim($rawValue);
                $valueKey = $this->normalizedKey($valueName);
                $value = ProductAttributeValue::query()
                    ->where('product_attribute_id', $attribute->id)
                    ->whereRaw('LOWER(value) = ?', [$valueKey])
                    ->first();
                $value ??= $attribute->values()->create([
                    'value' => $valueName,
                    'is_active' => true,
                ]);
                $values[$valueKey] = $value;
                $rawPrice = $valuePrices[$valueName] ?? 0;
                $rawFactor = $valueFactors[$valueName] ?? null;
                $templateValues[$value->id] = [
                    'position' => $position++,
                    'price' => is_numeric($rawPrice) ? $rawPrice : 0,
                    'factor' => is_numeric($rawFactor) ? $rawFactor : null,
                ];
            }

            $definitions[$attributeKey] = [
                'attribute' => $attribute,
                'values' => $values,
            ];
        }

        $template->attributeValues()->sync($templateValues);

        return $definitions;
    }

    /**
     * @param  array<string, mixed>  $variantData
     * @param  array<string, array{attribute: ProductAttribute, values: array<string, ProductAttributeValue>}>  $definitions
     */
    private function syncVariantAttributeValues(
        Product $variant,
        array $variantData,
        array $definitions,
        int $variantIndex,
        bool $isPrincipal,
    ): string {
        $selected = [];
        $rawSelections = $variantData['attribute_values'] ?? [];

        if (! is_array($rawSelections)) {
            $rawSelections = [];
        }

        foreach ($rawSelections as $selection) {
            if (! is_array($selection)) {
                continue;
            }
            $attributeKey = $this->normalizedKey($this->stringValue($selection['attribute'] ?? ''));
            $valueKey = $this->normalizedKey($this->stringValue($selection['value'] ?? ''));
            $definition = $definitions[$attributeKey] ?? null;
            $value = $definition['values'][$valueKey] ?? null;

            if (! $value instanceof ProductAttributeValue) {
                throw ValidationException::withMessages([
                    "variants.{$variantIndex}.attribute_values" => 'La variante contiene un atributo o valor no configurado.',
                ]);
            }

            $selected[$attributeKey] = $value;
        }

        if ($isPrincipal && $selected !== []) {
            throw ValidationException::withMessages([
                "variants.{$variantIndex}.attribute_values" => 'La variante principal representa el producto granel y no lleva atributos.',
            ]);
        }

        if (! $isPrincipal && count($selected) !== count($definitions)) {
            throw ValidationException::withMessages([
                "variants.{$variantIndex}.attribute_values" => 'Selecciona exactamente un valor de cada atributo.',
            ]);
        }

        /** @var list<int> $valueIds */
        $valueIds = collect($selected)->pluck('id')->map(
            static fn (mixed $id): int => is_numeric($id) ? (int) $id : 0,
        )->filter(static fn (int $id): bool => $id > 0)->values()->all();
        if (! $isPrincipal) {
            $this->productVariantIdentityGuard->assertAttributeCombinationCanChange(
                $variant,
                $valueIds,
                "variants.{$variantIndex}.attribute_values",
            );
        }
        $variant->attributeValues()->sync($valueIds);

        if ($isPrincipal) {
            return 'principal';
        }

        if ($definitions === []) {
            return "simple:{$variant->id}";
        }

        ksort($selected);

        return collect($selected)
            ->map(fn (ProductAttributeValue $value): string => (string) $value->id)
            ->implode(':');
    }

    /**
     * @param  array<int, array<string, mixed>>  $tiers
     */
    private function syncPriceTiers(Product $variant, array $tiers, int $variantIndex): void
    {
        foreach ($tiers as $tierIndex => $tierData) {
            $tierId = $this->nullableInt($tierData['id'] ?? null);
            $tier = $tierId === null
                ? new PriceTier()
                : $variant->priceTiers()->whereKey($tierId)->first();

            if (! $tier instanceof PriceTier) {
                throw ValidationException::withMessages([
                    "variants.{$variantIndex}.price_tiers.{$tierIndex}.id" => 'El precio no pertenece a esta variante.',
                ]);
            }

            $tier->fill([
                'product_id' => $variant->id,
                'label' => $tierData['label'] ?? null,
                'min_quantity' => $tierData['min_quantity'],
                'max_quantity' => $tierData['max_quantity'] ?? null,
                'unit_price' => $tierData['unit_price'],
                'is_active' => $tierData['is_active'] ?? true,
            ]);
            $tier->save();
        }
    }

    private function syncBasePrice(Product $variant, string $basePrice): void
    {
        $tier = $variant->priceTiers()
            ->where('is_active', true)
            ->where('min_quantity', '<=', 1)
            ->where(function ($query): void {
                $query->whereNull('max_quantity')
                    ->orWhere('max_quantity', '>=', 1);
            })
            ->orderByDesc('min_quantity')
            ->first();

        $tier ??= $variant->priceTiers()
            ->where('is_active', true)
            ->orderBy('min_quantity')
            ->first();

        if ($tier instanceof PriceTier) {
            $tier->update(['unit_price' => $basePrice]);

            return;
        }

        $tier = new PriceTier();
        $tier->fill([
            'product_id' => $variant->id,
            'label' => $variant->sale_mode === 'unit' ? 'Precio por unidad' : 'Precio base',
            'min_quantity' => $variant->sale_mode === 'unit' ? 1 : 0,
            'max_quantity' => null,
            'unit_price' => $basePrice,
            'is_active' => true,
        ]);
        $tier->save();
    }

    private function variantDisplayName(string $templateName, ?string $variantName): string
    {
        return $variantName === null || $variantName === ''
            ? $templateName
            : "{$templateName} - {$variantName}";
    }

    private function nullableInt(mixed $value): ?int
    {
        return is_numeric($value) ? (int) $value : null;
    }

    private function stringValue(mixed $value): string
    {
        return is_scalar($value) ? (string) $value : '';
    }

    private function normalizedKey(string $value): string
    {
        return mb_strtolower(mb_trim($value));
    }

    /** @return array<int|string, string|Closure> */
    private function relations(): array
    {
        return [
            'variants.template',
            'variants.baseUnit',
            'variants.contentUnit',
            'variants.attributeValues.attribute',
            'variants.purchaseUnits',
            'variants.stocks',
            'attributeValues.attribute',
            'variants.priceTiers' => function (Relation $relation): void {
                $relation->getQuery()->orderBy('min_quantity');
            },
        ];
    }
}
