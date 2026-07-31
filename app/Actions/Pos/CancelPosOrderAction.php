<?php

declare(strict_types=1);

namespace App\Actions\Pos;

use App\Exceptions\CashRegisterSessionException;
use App\Exceptions\PosOrderException;
use App\Models\CashRegisterSession;
use App\Models\PosOrder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\DB;

final readonly class CancelPosOrderAction
{
    public function execute(CashRegisterSession $session, PosOrder $order): PosOrder
    {
        return DB::transaction(function () use ($session, $order): PosOrder {
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

            $lockedOrder->update(['status' => 'cancelled']);

            return $lockedOrder->fresh([
                'items.product.baseUnit',
                'items.product.contentUnit',
                'items.product.template',
                'items.product.priceTiers' => function (Relation $relation): void {
                    $relation->getQuery()->where('is_active', true)->orderBy('min_quantity');
                },
            ]) ?? $lockedOrder;
        });
    }
}
