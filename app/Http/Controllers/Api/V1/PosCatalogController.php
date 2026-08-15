<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Sales\ResolveSaleStockConsumptionAction;
use App\Actions\Sales\SaleStockConsumption;
use App\Exceptions\CashRegisterSessionException;
use App\Exceptions\IncompatibleUnitException;
use App\Exceptions\ProductStockConversionException;
use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\ListPosCatalogRequest;
use App\Http\Resources\PosCatalogProductResource;
use App\Models\CashRegisterSession;
use App\Models\Product;
use App\Models\Stock;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\JsonResponse;

final class PosCatalogController extends ApiController
{
    public function __construct(
        private readonly ResolveSaleStockConsumptionAction $resolveSaleStockConsumptionAction,
    ) {}

    public function __invoke(
        ListPosCatalogRequest $request,
        CashRegisterSession $cashRegisterSession
    ): JsonResponse {
        if ($cashRegisterSession->status !== 'open') {
            throw CashRegisterSessionException::alreadyClosed($cashRegisterSession->id);
        }

        $cashRegister = $cashRegisterSession->cashRegister()->firstOrFail();
        $warehouseId = $cashRegister->warehouse_id;
        $search = $request->catalogSearch();
        $filters = $request->catalogFilters();
        $typeFilters = array_values(array_map(
            static fn (string $filter): string => mb_substr($filter, 5),
            array_filter($filters, static fn (string $filter): bool => str_starts_with($filter, 'type:'))
        ));
        $stockFilters = array_values(array_filter(
            $filters,
            static fn (string $filter): bool => str_starts_with($filter, 'stock:')
        ));
        $priceFilters = array_values(array_filter(
            $filters,
            static fn (string $filter): bool => str_starts_with($filter, 'price:')
        ));

        $products = Product::query()
            ->where('is_active', true)
            ->where(function (Builder $query): void {
                $query->whereNull('product_template_id')
                    ->orWhere(function (Builder $subQuery): void {
                        $subQuery->whereNotNull('product_template_id')
                            ->where('is_principal', true)
                            ->whereHas('template', fn (Builder $template): Builder => $template
                                ->where('is_active', true)
                                ->where('is_pos_visible', true));
                    });
            })
            ->with([
                'baseUnit',
                'contentUnit',
                'template',
                'stocks' => function (Relation $relation) use ($warehouseId): void {
                    $relation->getQuery()->where('warehouse_id', $warehouseId);
                },
                'priceTiers' => function (Relation $relation): void {
                    $relation->getQuery()->where('is_active', true)->orderBy('min_quantity');
                },
            ])
            ->when($search !== '', function (Builder $query) use ($search): void {
                $query->where(function (Builder $searchQuery) use ($search): void {
                    $searchQuery
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('sku', 'like', "%{$search}%")
                        ->orWhere('barcode', 'like', "%{$search}%")
                        ->orWhere('variant_name', 'like', "%{$search}%")
                        ->orWhereHas('template', fn (Builder $templateQuery): Builder => $templateQuery->where('name', 'like', "%{$search}%"));
                });
            })
            ->when(in_array('favorite', $filters, true), fn (Builder $query): Builder => $query->where('is_favorite', true))
            ->when(in_array('with-barcode', $filters, true), function (Builder $query): void {
                $query->whereNotNull('barcode')->where('barcode', '!=', '');
            })
            ->when($typeFilters !== [], function (Builder $query) use ($typeFilters): void {
                $query->whereHas('baseUnit', function (Builder $unitQuery) use ($typeFilters): void {
                    $unitQuery->whereIn('type', $typeFilters);
                });
            })
            ->when($stockFilters !== [], function (Builder $query) use ($stockFilters, $warehouseId): void {
                $query->where(function (Builder $stockQuery) use ($stockFilters, $warehouseId): void {
                    if (in_array('stock:positive', $stockFilters, true)) {
                        $stockQuery->orWhereHas('stocks', function (Builder $warehouseStock) use ($warehouseId): void {
                            $warehouseStock->where('warehouse_id', $warehouseId)->where('quantity', '>', 0);
                        });
                    }

                    if (in_array('stock:zero', $stockFilters, true)) {
                        $stockQuery->orWhere(function (Builder $zeroStock) use ($warehouseId): void {
                            $zeroStock
                                ->whereDoesntHave('stocks', function (Builder $warehouseStock) use ($warehouseId): void {
                                    $warehouseStock->where('warehouse_id', $warehouseId);
                                })
                                ->orWhereHas('stocks', function (Builder $warehouseStock) use ($warehouseId): void {
                                    $warehouseStock->where('warehouse_id', $warehouseId)->where('quantity', 0);
                                });
                        });
                    }

                    if (in_array('stock:negative', $stockFilters, true)) {
                        $stockQuery->orWhereHas('stocks', function (Builder $warehouseStock) use ($warehouseId): void {
                            $warehouseStock->where('warehouse_id', $warehouseId)->where('quantity', '<', 0);
                        });
                    }
                });
            })
            ->when(count($priceFilters) === 1, function (Builder $query) use ($priceFilters): void {
                $configured = $priceFilters[0] === 'price:configured';
                $method = $configured ? 'whereHas' : 'whereDoesntHave';
                $query->{$method}('priceTiers', function (Builder $priceQuery): void {
                    $priceQuery->where('is_active', true);
                });
            })
            ->orderByDesc('is_favorite')
            ->orderBy('name')
            ->orderBy('id')
            ->cursorPaginate($request->perPage());

        /** @var array<int, SaleStockConsumption> $stockProducts */
        $stockProducts = [];

        foreach ($products->getCollection() as $product) {
            try {
                $consumption = $this->resolveSaleStockConsumptionAction->execute(
                    $product,
                    '1',
                    false,
                );
                $stockProducts[$product->id] = $consumption;
            } catch (IncompatibleUnitException|ProductStockConversionException $exception) {
                $product->setAttribute('resolved_stock_available', '0.000000');
                $product->setAttribute('stock_configuration_error', $exception->getMessage());
            }
        }

        /** @var array<int, numeric-string> $stocksByProduct */
        $stocksByProduct = Stock::query()
            ->where('warehouse_id', $warehouseId)
            ->whereIn(
                'product_id',
                array_values(array_unique(array_map(
                    static fn (SaleStockConsumption $consumption): int => $consumption->product->id,
                    $stockProducts,
                ))),
            )
            ->pluck('quantity', 'product_id')
            ->all();

        foreach ($products->getCollection() as $product) {
            $consumption = $stockProducts[$product->id] ?? null;
            if (! $consumption instanceof SaleStockConsumption) {
                continue;
            }

            $sourceStock = $stocksByProduct[$consumption->product->id] ?? '0';
            $product->setAttribute(
                'resolved_stock_available',
                bcdiv($sourceStock, $consumption->quantity, 6),
            );
        }

        return $this->success([
            'items' => PosCatalogProductResource::collection($products->getCollection())->resolve($request),
            'next_cursor' => $products->nextCursor()?->encode(),
            'has_more' => $products->hasMorePages(),
        ]);
    }
}
