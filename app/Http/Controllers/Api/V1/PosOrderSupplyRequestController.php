<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Pos\RequestPosOrderSupplyAction;
use App\Http\Controllers\Api\ApiController;
use App\Http\Resources\InventoryTransferResource;
use App\Models\CashRegisterSession;
use App\Models\PosOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PosOrderSupplyRequestController extends ApiController
{
    public function __construct(
        private readonly RequestPosOrderSupplyAction $requestSupplyAction,
    ) {}

    public function store(
        Request $request,
        CashRegisterSession $cashRegisterSession,
        PosOrder $posOrder,
    ): JsonResponse {
        $transfer = $this->requestSupplyAction->execute(
            $cashRegisterSession,
            $posOrder,
            $request->user()?->id,
        );

        return $this->created(new InventoryTransferResource($transfer), 'Comanda enviada al almacén');
    }
}
