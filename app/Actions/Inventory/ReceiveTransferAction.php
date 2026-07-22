<?php

declare(strict_types=1);

namespace App\Actions\Inventory;

use App\Exceptions\InvalidTransferRouteException;
use App\Models\InventoryTransfer;
use App\Services\StockLedgerService;
use Illuminate\Support\Facades\DB;

final readonly class ReceiveTransferAction
{
    public function __construct(
        private StockLedgerService $stockLedgerService,
    ) {}

    public function execute(InventoryTransfer $inventoryTransfer, ?int $receivedBy = null): InventoryTransfer
    {
        if ($inventoryTransfer->status !== 'in_transit') {
            throw InvalidTransferRouteException::forStatus('in_transit', $inventoryTransfer->status);
        }

        return DB::transaction(function () use ($inventoryTransfer, $receivedBy): InventoryTransfer {
            $inventoryTransfer->load(['items.product', 'toWarehouse']);

            foreach ($inventoryTransfer->items as $item) {
                $this->stockLedgerService->registerIn(
                    $item->product,
                    $inventoryTransfer->toWarehouse,
                    (string) $item->quantity,
                    (string) $item->unit_cost,
                    'transfer_in',
                    $inventoryTransfer,
                    createdBy: $receivedBy,
                );
            }

            $inventoryTransfer->update([
                'status' => 'received',
                'received_at' => now(),
            ]);

            return $inventoryTransfer;
        });
    }
}
