<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Pos\CancelPosOrderAction;
use App\Actions\Pos\CreatePosOrderAction;
use App\Exceptions\CashRegisterSessionException;
use App\Exceptions\PosOrderException;
use App\Http\Controllers\Api\ApiController;
use App\Http\Resources\PosOrderResource;
use App\Models\CashRegisterSession;
use App\Models\PosOrder;
use Closure;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\JsonResponse;

final class PosOrderController extends ApiController
{
    public function __construct(
        private readonly CreatePosOrderAction $createAction,
        private readonly CancelPosOrderAction $cancelAction,
    ) {}

    public function index(CashRegisterSession $cashRegisterSession): JsonResponse
    {
        $this->ensureOpenSession($cashRegisterSession);

        $orders = $cashRegisterSession->orders()
            ->with($this->orderRelations())
            ->where('status', 'open')
            ->orderBy('number')
            ->get();

        return $this->success(PosOrderResource::collection($orders));
    }

    public function store(CashRegisterSession $cashRegisterSession): JsonResponse
    {
        $order = $this->createAction->execute($cashRegisterSession, request()->user()?->id);

        return $this->created(new PosOrderResource($this->loadOrder($order)), 'Orden creada');
    }

    public function show(CashRegisterSession $cashRegisterSession, PosOrder $posOrder): JsonResponse
    {
        $this->ensureOpenSession($cashRegisterSession);
        $this->ensureOrderBelongsToSession($cashRegisterSession, $posOrder);

        return $this->success(new PosOrderResource($this->loadOrder($posOrder)));
    }

    public function cancel(CashRegisterSession $cashRegisterSession, PosOrder $posOrder): JsonResponse
    {
        $order = $this->cancelAction->execute($cashRegisterSession, $posOrder);

        return $this->success(new PosOrderResource($order), 'Orden cancelada');
    }

    private function ensureOpenSession(CashRegisterSession $session): void
    {
        if ($session->status !== 'open') {
            throw CashRegisterSessionException::alreadyClosed($session->id);
        }
    }

    private function ensureOrderBelongsToSession(CashRegisterSession $session, PosOrder $order): void
    {
        if ($order->cash_register_session_id !== $session->id) {
            throw PosOrderException::doesNotBelongToSession();
        }
    }

    private function loadOrder(PosOrder $order): PosOrder
    {
        return $order->fresh($this->orderRelations()) ?? $order;
    }

    /** @return array<int|string, Closure|string> */
    private function orderRelations(): array
    {
        return [
            'items.product.baseUnit',
            'items.product.contentUnit',
            'items.product.template',
            'items.product.priceTiers' => function (Relation $relation): void {
                $relation->getQuery()->where('is_active', true)->orderBy('min_quantity');
            },
            'supplyRequests.items',
        ];
    }
}
