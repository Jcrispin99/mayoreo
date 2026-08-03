<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Pos\DeliverPosSupplyRequestAction;
use App\Actions\Pos\RequestPosOrderSupplyAction;
use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\StorePosSupplyRequest;
use App\Http\Requests\Api\V1\VersionedPosSupplyRequest;
use App\Http\Resources\PosSupplyRequestResource;
use App\Models\CashRegisterSession;
use App\Models\PosOrder;
use App\Models\PosSupplyRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;

final class PosOrderSupplyRequestController extends ApiController
{
    public function __construct(
        private readonly RequestPosOrderSupplyAction $requestSupplyAction,
        private readonly DeliverPosSupplyRequestAction $deliverSupplyAction,
    ) {}

    public function store(
        StorePosSupplyRequest $request,
        CashRegisterSession $cashRegisterSession,
        PosOrder $posOrder,
    ): JsonResponse {
        $transfer = $this->requestSupplyAction->execute(
            $cashRegisterSession,
            $posOrder,
            $request->assignedTo(),
            $request->user()?->id,
        );

        return $this->created(new PosSupplyRequestResource($transfer), 'Comanda enviada al almacén');
    }

    public function assignees(): JsonResponse
    {
        $users = User::role('warehouse')
            ->select(['id', 'name'])
            ->orderBy('name')
            ->get();

        return $this->success($users);
    }

    public function receive(
        VersionedPosSupplyRequest $request,
        CashRegisterSession $cashRegisterSession,
        PosOrder $posOrder,
        PosSupplyRequest $posSupplyRequest,
    ): JsonResponse {
        $received = $this->deliverSupplyAction->execute(
            $cashRegisterSession,
            $posOrder,
            $posSupplyRequest,
            $request->expectedVersion(),
            $request->user()?->id,
        );

        return $this->success(new PosSupplyRequestResource($received), 'Pedido recibido en caja');
    }
}
