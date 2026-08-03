<?php

declare(strict_types=1);

namespace App\Actions\Pos;

use App\Exceptions\CashRegisterSessionException;
use App\Exceptions\PosOrderException;
use App\Models\CashRegister;
use App\Models\CashRegisterSession;
use App\Models\PosOrder;
use App\Models\PosSupplyRequest;
use App\Models\Product;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Creates a mutable, versioned warehouse preparation task. Inventory does
 * not move until the POS confirms physical receipt of the prepared order.
 */
final readonly class RequestPosOrderSupplyAction
{
    public function execute(
        CashRegisterSession $session,
        PosOrder $order,
        int $assignedTo,
        ?int $requestedBy,
    ): PosSupplyRequest {
        return DB::transaction(function () use ($session, $order, $assignedTo, $requestedBy): PosSupplyRequest {
            $lockedSession = CashRegisterSession::query()->lockForUpdate()->findOrFail($session->id);

            if ($lockedSession->status !== 'open') {
                throw CashRegisterSessionException::alreadyClosed($lockedSession->id);
            }

            $lockedOrder = PosOrder::query()
                ->where('cash_register_session_id', $lockedSession->id)
                ->lockForUpdate()
                ->find($order->id);

            if (! $lockedOrder instanceof PosOrder) {
                throw PosOrderException::doesNotBelongToSession();
            }

            if ($lockedOrder->status !== 'open') {
                throw PosOrderException::notOpen($lockedOrder->id);
            }

            if ($lockedOrder->supplyRequests()->whereNotIn('status', ['delivered', 'cancelled'])->exists()) {
                throw PosOrderException::supplyPending($lockedOrder->id);
            }

            $assignee = User::query()->lockForUpdate()->find($assignedTo);

            if (! $assignee instanceof User || ! $assignee->hasRole('warehouse')) {
                throw ValidationException::withMessages([
                    'assigned_to' => 'Selecciona un usuario con el rol warehouse.',
                ]);
            }

            $cashRegister = CashRegister::query()->findOrFail($lockedSession->cash_register_id);
            $toWarehouse = Warehouse::query()
                ->whereKey($cashRegister->warehouse_id)
                ->where('store_id', $cashRegister->store_id)
                ->where('is_active', true)
                ->firstOrFail();
            $fromWarehouse = Warehouse::query()
                ->where('store_id', $cashRegister->store_id)
                ->where('type', 'main')
                ->where('is_active', true)
                ->where('id', '!=', $toWarehouse->id)
                ->orderByDesc('is_default')
                ->orderBy('id')
                ->first();

            if (! $fromWarehouse instanceof Warehouse) {
                throw PosOrderException::noSupplyWarehouse($cashRegister->store_id);
            }

            $items = $lockedOrder->items()->with('product')->orderBy('product_id')->get();
            $deliveredRequests = $lockedOrder->supplyRequests()
                ->where('status', 'delivered')
                ->with('items')
                ->lockForUpdate()
                ->get();
            /** @var array<int, numeric-string> $alreadyDelivered */
            $alreadyDelivered = [];

            foreach ($deliveredRequests as $deliveredRequest) {
                foreach ($deliveredRequest->items as $deliveredItem) {
                    /** @var numeric-string $current */
                    $current = $alreadyDelivered[$deliveredItem->product_id] ?? '0';
                    /** @var numeric-string $quantity */
                    $quantity = (string) $deliveredItem->requested_quantity;
                    $alreadyDelivered[$deliveredItem->product_id] = bcadd($current, $quantity, 6);
                }
            }

            /** @var list<array{product_id: int, requested_quantity: numeric-string, warehouse_notes: string|null}> $requestedItems */
            $requestedItems = [];
            foreach ($items as $item) {
                if (! $item->product instanceof Product) {
                    throw PosOrderException::productUnavailable($item->product_id);
                }

                /** @var numeric-string $quantity */
                $quantity = (string) $item->quantity;
                /** @var numeric-string $delivered */
                $delivered = $alreadyDelivered[$item->product_id] ?? '0';
                /** @var numeric-string $remaining */
                $remaining = bcsub($quantity, $delivered, 6);

                if (bccomp($remaining, '0', 6) > 0) {
                    $requestedItems[] = [
                        'product_id' => $item->product_id,
                        'requested_quantity' => $remaining,
                        'warehouse_notes' => $item->warehouse_notes,
                    ];
                }
            }

            if ($requestedItems === []) {
                throw PosOrderException::nothingMissing($lockedOrder->id);
            }

            $supplyRequest = PosSupplyRequest::query()->create([
                'pos_order_id' => $lockedOrder->id,
                'from_warehouse_id' => $fromWarehouse->id,
                'to_warehouse_id' => $toWarehouse->id,
                'assigned_to' => $assignee->id,
                'assigned_by' => $requestedBy,
                'status' => 'assigned',
                'warehouse_notes' => $lockedOrder->warehouse_notes,
                'version' => 1,
                'acknowledged_version' => 0,
                'warehouse_notes_changed_version' => 1,
                'assigned_at' => now(),
            ]);

            foreach ($requestedItems as $requestedItem) {
                $supplyRequest->items()->create([
                    ...$requestedItem,
                    'prepared_quantity' => '0',
                    'change_type' => 'added',
                    'changed_version' => 1,
                ]);
            }

            $supplyRequest->changes()->create([
                'version' => 1,
                'actor_id' => $requestedBy,
                'type' => 'created',
                'changes' => $requestedItems,
            ]);

            return $supplyRequest->load([
                'items.product.baseUnit',
                'posOrder',
                'fromWarehouse.store',
                'toWarehouse.store',
                'assignee',
            ]);
        });
    }
}
