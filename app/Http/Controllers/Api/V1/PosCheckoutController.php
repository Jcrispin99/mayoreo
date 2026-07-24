<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Pos\CompletePosOrderAction;
use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\CheckoutPosOrderRequest;
use App\Http\Resources\PosCheckoutResource;
use App\Models\CashRegisterSession;
use App\Models\PosOrder;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

final class PosCheckoutController extends ApiController
{
    public function __construct(
        private readonly CompletePosOrderAction $completePosOrderAction,
    ) {}

    public function __invoke(
        CheckoutPosOrderRequest $request,
        CashRegisterSession $cashRegisterSession,
        PosOrder $posOrder,
    ): JsonResponse {
        $result = $this->completePosOrderAction->execute(
            $cashRegisterSession,
            $posOrder,
            $request->expectedTotal(),
            $request->paymentMethod(),
            $request->receivedAmount(),
            $request->paymentReference(),
            $request->user()?->id,
        );

        return $this->success(
            new PosCheckoutResource($result),
            $result->created ? 'Venta registrada' : 'Venta recuperada',
            $result->created ? Response::HTTP_CREATED : Response::HTTP_OK,
        );
    }
}
