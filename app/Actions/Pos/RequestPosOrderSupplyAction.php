<?php

declare(strict_types=1);

namespace App\Actions\Pos;

use App\Exceptions\CashRegisterSessionException;
use App\Exceptions\PosOrderException;
use App\Models\CashRegister;
use App\Models\CashRegisterSession;
use App\Models\InventoryTransfer;
use App\Models\PosOrder;
use App\Models\Product;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * "Comanda": genera un traslado en borrador desde el almacén principal de
 * la tienda hacia el almacén de la caja, con lo que le falta a la orden
 * respecto a lo que YA se le solicitó al almacén por comandas anteriores
 * de esa misma orden. No se compara contra el stock del sistema: el
 * conteo puede no reflejar la realidad (ventas o mermas no registradas),
 * así que el vendedor siempre puede volver a pedir si en la práctica
 * sigue sin tener el producto, hasta cubrir la cantidad de la orden.
 */
final readonly class RequestPosOrderSupplyAction
{
    public function execute(
        CashRegisterSession $session,
        PosOrder $order,
        int $assignedTo,
        ?int $requestedBy,
    ): InventoryTransfer {
        return DB::transaction(function () use ($session, $order, $assignedTo, $requestedBy): InventoryTransfer {
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
                ->firstOrFail();

            $fromWarehouse = Warehouse::query()
                ->where('store_id', $cashRegister->store_id)
                ->where('type', 'main')
                ->where('id', '!=', $toWarehouse->id)
                ->first();

            if (! $fromWarehouse instanceof Warehouse) {
                throw PosOrderException::noSupplyWarehouse($cashRegister->store_id);
            }

            $items = $lockedOrder->items()->with('product')->orderBy('product_id')->get();

            $existingTransfers = InventoryTransfer::query()
                ->where('pos_order_id', $lockedOrder->id)
                ->where('status', '!=', 'cancelled')
                ->with('items')
                ->lockForUpdate()
                ->get();

            /** @var array<int, numeric-string> $alreadyRequested */
            $alreadyRequested = [];

            foreach ($existingTransfers as $existingTransfer) {
                foreach ($existingTransfer->items as $existingItem) {
                    /** @var numeric-string $current */
                    $current = $alreadyRequested[$existingItem->product_id] ?? '0';
                    /** @var numeric-string $existingQuantity */
                    $existingQuantity = (string) $existingItem->quantity;
                    $alreadyRequested[$existingItem->product_id] = bcadd($current, $existingQuantity, 6);
                }
            }

            /** @var list<array{product_id: int, quantity: numeric-string}> $shortages */
            $shortages = [];

            foreach ($items as $item) {
                $product = $item->product;

                if (! $product instanceof Product) {
                    throw PosOrderException::productUnavailable($item->product_id);
                }

                /** @var numeric-string $itemQuantity */
                $itemQuantity = (string) $item->quantity;
                /** @var numeric-string $requestedQuantity */
                $requestedQuantity = $alreadyRequested[$item->product_id] ?? '0';
                /** @var numeric-string $missing */
                $missing = bcsub($itemQuantity, $requestedQuantity, 6);

                if (bccomp($missing, '0', 6) > 0) {
                    $shortages[] = [
                        'product_id' => $item->product_id,
                        'quantity' => $missing,
                    ];
                }
            }

            if ($shortages === []) {
                throw PosOrderException::nothingMissing($lockedOrder->id);
            }

            $transfer = InventoryTransfer::query()->create([
                'from_warehouse_id' => $fromWarehouse->id,
                'to_warehouse_id' => $toWarehouse->id,
                'pos_order_id' => $lockedOrder->id,
                'assigned_to' => $assignee->id,
                'assigned_by' => $requestedBy,
                'assigned_at' => now(),
                'status' => 'draft',
                'notes' => "Solicitado desde POS, orden #{$lockedOrder->number}.",
                'created_by' => $requestedBy,
            ]);

            foreach ($shortages as $shortage) {
                $transfer->items()->create($shortage);
            }

            return $transfer->load('items');
        });
    }
}
