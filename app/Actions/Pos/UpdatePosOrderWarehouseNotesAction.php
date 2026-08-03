<?php

declare(strict_types=1);

namespace App\Actions\Pos;

use App\Exceptions\CashRegisterSessionException;
use App\Exceptions\PosOrderException;
use App\Models\CashRegisterSession;
use App\Models\PosOrder;
use Illuminate\Support\Facades\DB;

final readonly class UpdatePosOrderWarehouseNotesAction
{
    public function __construct(private SyncPosSupplyRequestAction $syncSupplyRequestAction) {}

    public function execute(
        CashRegisterSession $session,
        PosOrder $order,
        ?string $warehouseNotes,
        ?int $actorId,
    ): PosOrder {
        return DB::transaction(function () use ($session, $order, $warehouseNotes, $actorId): PosOrder {
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

            $lockedOrder->update(['warehouse_notes' => $warehouseNotes]);
            $this->syncSupplyRequestAction->execute($lockedOrder, $actorId);

            return $lockedOrder;
        });
    }
}
