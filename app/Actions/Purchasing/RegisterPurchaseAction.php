<?php

declare(strict_types=1);

namespace App\Actions\Purchasing;

use App\Actions\Sales\ResolveSaleStockConsumptionAction;
use App\Exceptions\PurchaseOrderStateException;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\Warehouse;
use App\Services\StockLedgerService;
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
                    ->with('product')
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

                // Resolve with a probe quantity of 1 to get the per-unit
                // conversion factor (and the product whose stock actually
                // moves): 1 for the principal or a template-less product,
                // or the variant's content converted to the principal's
                // base unit otherwise.
                $resolution = $this->resolveVariantStockAction->execute($product, '1', lockForUpdate: true);

                $quantityBase = bcmul($rawQuantity, $resolution->quantity, 6);
                $unitCostBase = bcdiv((string) $item->unit_cost, $resolution->quantity, 4);

                $item->update([
                    'quantity' => bcadd($rawQuantity, '0', 6),
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
