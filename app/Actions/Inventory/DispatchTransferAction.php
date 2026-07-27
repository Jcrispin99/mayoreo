<?php

declare(strict_types=1);

namespace App\Actions\Inventory;

use App\Exceptions\InvalidTransferRouteException;
use App\Models\InventoryTransfer;
use App\Services\StockLedgerService;
use Illuminate\Support\Facades\DB;

final readonly class DispatchTransferAction
{
    public function __construct(
        private StockLedgerService $stockLedgerService,
    ) {}

    public function execute(
        InventoryTransfer $inventoryTransfer,
        ?int $dispatchedBy = null,
        bool $allowNegative = false,
    ): InventoryTransfer {
        if ($inventoryTransfer->status !== 'draft') {
            throw InvalidTransferRouteException::forStatus('draft', $inventoryTransfer->status);
        }

        return DB::transaction(function () use ($inventoryTransfer, $dispatchedBy, $allowNegative): InventoryTransfer {
            $inventoryTransfer->load(['items.product', 'fromWarehouse']);

            foreach ($inventoryTransfer->items as $item) {
                $movement = $this->stockLedgerService->registerOut(
                    $item->product,
                    $inventoryTransfer->fromWarehouse,
                    (string) $item->quantity,
                    'transfer_out',
                    $inventoryTransfer,
                    createdBy: $dispatchedBy,
                    allowNegative: $allowNegative,
                );

                $item->update(['unit_cost' => $movement->unit_cost]);
            }

            $inventoryTransfer->update([
                'status' => 'in_transit',
                'dispatched_at' => now(),
            ]);

            return $inventoryTransfer;
        });
    }
}
