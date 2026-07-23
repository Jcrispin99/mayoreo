<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Pos\RegisterCashMovementAction;
use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\StoreCashRegisterMovementRequest;
use App\Http\Resources\CashRegisterMovementResource;
use App\Models\CashRegisterSession;
use Illuminate\Http\JsonResponse;

final class CashRegisterMovementController extends ApiController
{
    public function __construct(
        private readonly RegisterCashMovementAction $registerMovementAction,
    ) {}

    public function store(StoreCashRegisterMovementRequest $request, CashRegisterSession $cashRegisterSession): JsonResponse
    {
        $movement = $this->registerMovementAction->execute(
            $cashRegisterSession,
            $request->movementType(),
            $request->amount(),
            $request->reason(),
            $request->notes(),
            $request->user()?->id,
        );

        return $this->created(new CashRegisterMovementResource($movement->load('creator')));
    }
}
