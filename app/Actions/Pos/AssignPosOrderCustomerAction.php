<?php

declare(strict_types=1);

namespace App\Actions\Pos;

use App\Exceptions\CashRegisterSessionException;
use App\Exceptions\CustomerOperationException;
use App\Exceptions\PosOrderException;
use App\Models\CashRegisterSession;
use App\Models\Customer;
use App\Models\PosOrder;
use Illuminate\Support\Facades\DB;

final readonly class AssignPosOrderCustomerAction
{
    public function execute(CashRegisterSession $session, PosOrder $order, ?int $customerId): PosOrder
    {
        return DB::transaction(function () use ($session, $order, $customerId): PosOrder {
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

            if ($lockedOrder->supplyRequests()->whereIn('status', ['draft', 'in_transit'])->exists()) {
                throw PosOrderException::supplyPending($lockedOrder->id);
            }

            if ($customerId !== null) {
                $customer = Customer::query()->lockForUpdate()->find($customerId);

                if (! $customer instanceof Customer || ! $customer->is_active) {
                    throw CustomerOperationException::inactive($customerId);
                }
            }

            $lockedOrder->update(['customer_id' => $customerId]);

            return $lockedOrder;
        });
    }
}
