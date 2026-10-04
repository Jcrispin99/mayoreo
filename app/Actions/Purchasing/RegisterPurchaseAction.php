<?php

declare(strict_types=1);

namespace App\Actions\Purchasing;

use App\Actions\Sales\ResolveSaleStockConsumptionAction;
use App\Exceptions\PurchaseOrderStateException;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\Warehouse;
use App\Services\StockLedgerService;
use App\Services\UnitConversionService;
use Illuminate\Support\Facades\DB;
use LogicException;

final readonly class RegisterPurchaseAction
{
    public function __construct(
        /**
         * Shared with Sales: resolves a packaged template variant down to its
         * template's principal product, converting the quantity to the
         * principal's base unit. Direction-agnostic (credit or debit), so
         * it's reused here as-is rather than duplicated under Purchasing.
         */
        private ResolveSaleStockConsumptionAction $resolveVariantStockAction,
        private UnitConversionService $unitConversionService,
        private StockLedgerService $stockLedgerService,
    ) {}

    public function execute(PurchaseOrder $purchaseOrder, ?int $confirmedBy = null): PurchaseOrder
    {
        return DB::transaction(function () use ($purchaseOrder, $confirmedBy): PurchaseOrder {
            $lockedPurchaseOrder = PurchaseOrder::query()
                ->lockForUpdate()
                ->findOrFail($purchaseOrder->id);

            if ($lockedPurchaseOrder->status !== 'draft') {
                throw PurchaseOrderStateException::notDraft($lockedPurchaseOrder->id);
            }

            $lockedPurchaseOrder->setRelation(
                'items',
                $lockedPurchaseOrder->items()
                    ->with(['product', 'productPurchaseUnit'])
                    ->lockForUpdate()
                    ->get(),
            );
            $lockedPurchaseOrder->load('warehouse');
            $warehouse = $lockedPurchaseOrder->warehouse;

            if (! $warehouse instanceof Warehouse) {
                throw new LogicException('La orden de compra no tiene un almacén válido.');
            }

            foreach ($lockedPurchaseOrder->items as $item) {
                $product = $item->product;
                if (! $product instanceof Product) {
                    throw new LogicException('La línea de compra no tiene un producto válido.');
                }

                /** @var numeric-string $rawQuantity */
                $rawQuantity = (string) $item->quantity_purchased;
                /** @var numeric-string $quantityInVariantUnit */
                $quantityInVariantUnit = $this->unitConversionService->toBaseUnit(
                    $product,
                    $rawQuantity,
                    $item->productPurchaseUnit,
                );

                // First convert the supplier package into the selected
                // variant, then resolve the variant into the stock product.
                // Example: 2 pallets × 10 sacks × 50 kg = 1,000 kg.
                $resolution = $this->resolveVariantStockAction->execute(
                    $product,
                    $quantityInVariantUnit,
                    lockForUpdate: true,
                );

                $quantityBase = $resolution->quantity;
                /** @var numeric-string $rawUnitCost */
                $rawUnitCost = (string) $item->unit_cost;
                $lineCost = bcmul($rawQuantity, $rawUnitCost, 6);
                $unitCostBase = bcdiv($lineCost, $quantityBase, 4);

                $item->update([
                    'quantity' => $quantityInVariantUnit,
                    'stock_product_id' => $resolution->product->id,
                    'stock_quantity' => $quantityBase,
                ]);

                $this->stockLedgerService->registerIn(
                    $resolution->product,
                    $warehouse,
                    $quantityBase,
                    $unitCostBase,
                    'purchase',
                    $lockedPurchaseOrder,
                    createdBy: $confirmedBy,
                );
            }

            $lockedPurchaseOrder->update([
                'status' => 'confirmed',
                'received_at' => now(),
            ]);

            return $lockedPurchaseOrder;
        });
    }
}
