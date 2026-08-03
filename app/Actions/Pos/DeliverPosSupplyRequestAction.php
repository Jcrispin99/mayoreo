<?php

declare(strict_types=1);

namespace App\Actions\Pos;

use App\Actions\Inventory\DispatchTransferAction;
use App\Actions\Inventory\ReceiveTransferAction;
use App\Exceptions\CashRegisterSessionException;
use App\Exceptions\PosOrderException;
use App\Exceptions\PosSupplyRequestException;
use App\Exceptions\StalePosSupplyRequestException;
use App\Models\CashRegisterSession;
use App\Models\InventoryTransfer;
use App\Models\PosOrder;
use App\Models\PosSupplyRequest;
use Illuminate\Support\Facades\DB;

final readonly class DeliverPosSupplyRequestAction
{
    public function __construct(
        private DispatchTransferAction $dispatchTransferAction,
        private ReceiveTransferAction $receiveTransferAction,
    ) {}

    public function execute(
        CashRegisterSession $session,
        PosOrder $order,
        PosSupplyRequest $request,
        int $expectedVersion,
        ?int $receivedBy,
    ): PosSupplyRequest {
        return DB::transaction(function () use ($session, $order, $request, $expectedVersion, $receivedBy): PosSupplyRequest {
            $lockedSession = CashRegisterSession::query()->lockForUpdate()->findOrFail($session->id);
            if ($lockedSession->status !== 'open') {
                throw CashRegisterSessionException::alreadyClosed($lockedSession->id);
            }

            $lockedOrder = PosOrder::query()
                ->where('cash_register_session_id', $lockedSession->id)
                ->lockForUpdate()
                ->find($order->id);
            if (! $lockedOrder instanceof PosOrder || $request->pos_order_id !== $lockedOrder->id) {
                throw PosOrderException::doesNotBelongToSession();
            }

            $lockedRequest = PosSupplyRequest::query()->lockForUpdate()->findOrFail($request->id);
            if ($lockedRequest->version !== $expectedVersion) {
                throw new StalePosSupplyRequestException;
            }
            if ($lockedRequest->status !== 'ready') {
                throw PosSupplyRequestException::invalidStatus($lockedRequest->status);
            }

            $items = $lockedRequest->items()->where('requested_quantity', '>', 0)->lockForUpdate()->get();
            if ($items->isEmpty()) {
                throw PosSupplyRequestException::incomplete();
            }

            $transfer = InventoryTransfer::query()->create([
                'from_warehouse_id' => $lockedRequest->from_warehouse_id,
                'to_warehouse_id' => $lockedRequest->to_warehouse_id,
                'pos_order_id' => $lockedOrder->id,
                'assigned_to' => $lockedRequest->assigned_to,
                'assigned_by' => $lockedRequest->assigned_by,
                'assigned_at' => $lockedRequest->assigned_at,
                'status' => 'draft',
                'notes' => "Entrega de almacén para orden #{$lockedOrder->number}, versión {$lockedRequest->version}.",
                'created_by' => $receivedBy,
            ]);

            foreach ($items as $item) {
                $transfer->items()->create([
                    'product_id' => $item->product_id,
                    'quantity' => $item->requested_quantity,
                ]);
            }

            $dispatched = $this->dispatchTransferAction->execute(
                $transfer,
                $lockedRequest->assigned_to,
                allowNegative: true,
            );
            $received = $this->receiveTransferAction->execute($dispatched, $receivedBy);

            $lockedRequest->update([
                'status' => 'delivered',
                'delivered_at' => now(),
                'inventory_transfer_id' => $received->id,
            ]);

            return $lockedRequest->fresh([
                'items.product.baseUnit',
                'posOrder',
                'fromWarehouse.store',
                'toWarehouse.store',
                'assignee',
                'inventoryTransfer',
            ]) ?? $lockedRequest;
        });
    }
}
