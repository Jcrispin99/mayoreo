<?php

declare(strict_types=1);

namespace App\Actions\Purchasing;

use App\Actions\Catalog\ConvertToBaseUnitAction;
use App\Exceptions\PurchaseOrderStateException;
use App\Models\Product;
use App\Models\ProductPurchaseUnit;
use App\Models\PurchaseOrder;
use App\Models\Warehouse;
use App\Services\StockLedgerService;
use Illuminate\Support\Facades\DB;
use LogicException;

final readonly class RegisterPurchaseAction
{
    public function __construct(
        private ConvertToBaseUnitAction $convertToBaseUnitAction,
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

                $purchaseUnit = $item->productPurchaseUnit instanceof ProductPurchaseUnit
                    ? $item->productPurchaseUnit
                    : null;

                $quantityBase = $this->convertToBaseUnitAction->execute(
                    $product,
                    (string) $item->quantity_purchased,
                    $purchaseUnit,
                );

                $conversionFactor = $purchaseUnit instanceof ProductPurchaseUnit
                    ? (string) $purchaseUnit->conversion_factor
                    : '1';
                $unitCostBase = bcdiv((string) $item->unit_cost, $conversionFactor, 4);

                $item->update(['quantity' => $quantityBase]);

                $this->stockLedgerService->registerIn(
                    $product,
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
