<?php

declare(strict_types=1);

namespace App\Actions\Purchasing;

use App\Actions\Catalog\ConvertToBaseUnitAction;
use App\Models\ProductPurchaseUnit;
use App\Models\PurchaseOrder;
use App\Services\StockLedgerService;
use Illuminate\Support\Facades\DB;

final readonly class RegisterPurchaseAction
{
    public function __construct(
        private ConvertToBaseUnitAction $convertToBaseUnitAction,
        private StockLedgerService $stockLedgerService,
    ) {}

    public function execute(PurchaseOrder $purchaseOrder, ?int $confirmedBy = null): PurchaseOrder
    {
        return DB::transaction(function () use ($purchaseOrder, $confirmedBy): PurchaseOrder {
            $purchaseOrder->load(['items.product', 'items.productPurchaseUnit', 'warehouse']);

            foreach ($purchaseOrder->items as $item) {
                $purchaseUnit = $item->productPurchaseUnit instanceof ProductPurchaseUnit
                    ? $item->productPurchaseUnit
                    : null;

                $quantityBase = $this->convertToBaseUnitAction->execute(
                    $item->product,
                    (string) $item->quantity_purchased,
                    $purchaseUnit,
                );

                $unitCostBase = bcdiv((string) $item->unit_cost, $purchaseUnit?->conversion_factor ?? '1', 4);

                $item->update(['quantity' => $quantityBase]);

                $this->stockLedgerService->registerIn(
                    $item->product,
                    $purchaseOrder->warehouse,
                    $quantityBase,
                    $unitCostBase,
                    'purchase',
                    $purchaseOrder,
                    createdBy: $confirmedBy,
                );
            }

            $purchaseOrder->update([
                'status' => 'confirmed',
                'received_at' => now(),
            ]);

            return $purchaseOrder;
        });
    }
}
