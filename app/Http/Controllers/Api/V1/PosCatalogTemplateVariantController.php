<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Sales\ResolveSaleStockConsumptionAction;
use App\Actions\Sales\SaleStockConsumption;
use App\Exceptions\CashRegisterSessionException;
use App\Exceptions\IncompatibleUnitException;
use App\Exceptions\ProductStockConversionException;
use App\Http\Controllers\Api\ApiController;
use App\Http\Resources\PosCatalogProductResource;
use App\Models\CashRegisterSession;
use App\Models\ProductTemplate;
use App\Models\Stock;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\JsonResponse;

final class PosCatalogTemplateVariantController extends ApiController
{
    public function __construct(
        private readonly ResolveSaleStockConsumptionAction $resolveSaleStockConsumptionAction,
    ) {}

    public function __invoke(
        CashRegisterSession $cashRegisterSession,
        ProductTemplate $productTemplate
    ): JsonResponse {
        if ($cashRegisterSession->status !== 'open') {
            throw CashRegisterSessionException::alreadyClosed($cashRegisterSession->id);
        }

        $cashRegister = $cashRegisterSession->cashRegister()->firstOrFail();
        $warehouseId = $cashRegister->warehouse_id;

        $products = $productTemplate->variants()
            ->where('is_active', true)
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
            ->get();

        /** @var array<int, SaleStockConsumption> $stockProducts */
        $stockProducts = [];

        foreach ($products as $product) {
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

        foreach ($products as $product) {
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

        return $this->success(PosCatalogProductResource::collection($products));
    }
}
