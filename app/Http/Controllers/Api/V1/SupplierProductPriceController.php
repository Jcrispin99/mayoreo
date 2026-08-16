<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\ApiController;
use App\Models\Product;
use App\Models\ProductTemplate;
use App\Models\Supplier;
use App\Models\SupplierProductPrice;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SupplierProductPriceController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        /** @var array{search?: string|null, filter?: string|null, supplier_ids?: string|null, page?: int|null, per_page?: int|null} $validated */
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'filter' => ['nullable', 'in:all,priced,missing'],
            'supplier_ids' => ['nullable', 'string', 'max:500'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:25'],
        ]);
        $supplierIds = $this->supplierIds($validated['supplier_ids'] ?? null);
        $filter = (string) ($validated['filter'] ?? 'all');
        $search = mb_trim((string) ($validated['search'] ?? ''));
        $perPage = (int) ($validated['per_page'] ?? 12);

        $products = Product::query()
            ->with([
                'template:id,name',
                'baseUnit:id,code,name',
                'supplierPrices' => function (Relation $relation): void {
                    $relation->getQuery()->with('purchaseUnit:id,product_id,name,conversion_factor');
                },
            ])
            ->where('is_active', true)
            ->when($search !== '', function (Builder $query) use ($search): void {
                $query->where(function (Builder $matching) use ($search): void {
                    $matching->where('sku', 'like', "%{$search}%")
                        ->orWhere('variant_name', 'like', "%{$search}%")
                        ->orWhere('name', 'like', "%{$search}%")
                        ->orWhereHas('template', fn (Builder $template) => $template->where('name', 'like', "%{$search}%"));
                });
            })
            ->when($filter === 'priced', fn (Builder $query) => $query->whereHas(
                'supplierPrices',
                fn (Builder $prices) => $prices->when(
                    $supplierIds !== [],
                    fn (Builder $selected) => $selected->whereIn('supplier_id', $supplierIds),
                ),
            ))
            ->when($filter === 'missing', fn (Builder $query) => $query->whereDoesntHave(
                'supplierPrices',
                fn (Builder $prices) => $prices->when(
                    $supplierIds !== [],
                    fn (Builder $selected) => $selected->whereIn('supplier_id', $supplierIds),
                ),
            ))
            ->orderBy(
                Product::query()->getModel()->getTable().'.name',
            )
            ->orderBy('id')
            ->paginate($perPage);

        $items = $products->getCollection()->map(function (Product $product): array {
            $template = $product->template;

            return [
                'id' => $product->id,
                'template_name' => $template instanceof ProductTemplate ? $template->name : $product->name,
                'variant_name' => $product->variant_name,
                'sku' => $product->sku,
                'base_unit' => [
                    'id' => $product->baseUnit->id,
                    'code' => $product->baseUnit->code,
                    'name' => $product->baseUnit->name,
                ],
                'prices' => $product->supplierPrices->map(
                    fn (SupplierProductPrice $price): array => $this->priceData($product, $price),
                )->values(),
            ];
        })->values();

        return $this->success([
            'items' => $items,
            'pagination' => [
                'current_page' => $products->currentPage(),
                'last_page' => $products->lastPage(),
                'per_page' => $products->perPage(),
                'total' => $products->total(),
                'from' => $products->firstItem(),
                'to' => $products->lastItem(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var array{supplier_id: int, product_id: int, unit_cost: int|float|numeric-string, quoted_at: string, notes?: string|null} $validated */
        $validated = $request->validate([
            'supplier_id' => ['required', 'integer', 'exists:suppliers,id'],
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'product_purchase_unit_id' => ['prohibited'],
            'unit_cost' => ['required', 'numeric', 'gt:0', 'decimal:0,4'],
            'quoted_at' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
        $product = Product::query()
            ->with('baseUnit:id,code,name')
            ->findOrFail($validated['product_id']);

        $price = SupplierProductPrice::query()->updateOrCreate([
            'supplier_id' => $validated['supplier_id'],
            'product_id' => $product->id,
        ], [
            'product_purchase_unit_id' => null,
            'unit_cost' => $validated['unit_cost'],
            'quoted_at' => $validated['quoted_at'],
            'notes' => $validated['notes'] ?? null,
            'updated_by' => $request->user()?->id,
        ]);
        $price->load('purchaseUnit:id,product_id,name,conversion_factor');

        return $this->success($this->priceData($product, $price), 'Precio del proveedor guardado correctamente.');
    }

    public function suppliers(): JsonResponse
    {
        $suppliers = Supplier::query()
            ->where('is_active', true)
            ->whereRaw('LOWER(name) <> ?', ['inventario inicial'])
            ->orderBy('name')
            ->get(['id', 'name', 'document_number', 'phone', 'email', 'is_active']);

        return $this->success($suppliers);
    }

    /** @return list<int> */
    private function supplierIds(mixed $value): array
    {
        if (! is_string($value) || mb_trim($value) === '') {
            return [];
        }

        return array_values(array_unique(array_filter(
            array_map(static fn (string $id): int => (int) $id, explode(',', $value)),
            static fn (int $id): bool => $id > 0,
        )));
    }

    /** @return array<string, mixed> */
    private function priceData(Product $product, SupplierProductPrice $price): array
    {
        $purchaseUnit = $price->product_purchase_unit_id === null ? null : $price->purchaseUnit;
        $conversionFactor = $purchaseUnit === null ? 1 : (float) $purchaseUnit->conversion_factor;
        $unitCost = (float) $price->unit_cost;
        $baseCode = mb_strtolower($product->baseUnit->code);
        $comparisonUnit = $baseCode === 'kg' ? 'kg' : 'unidad';

        return [
            'id' => $price->id,
            'supplier_id' => $price->supplier_id,
            'product_purchase_unit_id' => $price->product_purchase_unit_id,
            'unit_cost' => $price->unit_cost,
            'original_unit' => $purchaseUnit === null ? $comparisonUnit : $purchaseUnit->name,
            'comparison_price' => $conversionFactor > 0
                ? round($unitCost / $conversionFactor, 4)
                : null,
            'comparison_unit' => $comparisonUnit,
            'quoted_at' => $price->quoted_at->toDateString(),
            'notes' => $price->notes,
        ];
    }
}
