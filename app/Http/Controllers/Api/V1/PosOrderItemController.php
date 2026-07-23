<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Pos\SavePosOrderItemAction;
use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\StorePosOrderItemRequest;
use App\Http\Requests\Api\V1\UpdatePosOrderItemRequest;
use App\Http\Resources\PosOrderResource;
use App\Models\CashRegisterSession;
use App\Models\PosOrder;
use App\Models\Product;
use App\Models\Productable;
use Illuminate\Http\JsonResponse;

final class PosOrderItemController extends ApiController
{
    public function __construct(
        private readonly SavePosOrderItemAction $saveAction,
    ) {}

    public function store(
        StorePosOrderItemRequest $request,
        CashRegisterSession $cashRegisterSession,
        PosOrder $posOrder,
    ): JsonResponse {
        $product = Product::query()->findOrFail($request->integer('product_id'));
        $order = $this->saveAction->add(
            $cashRegisterSession,
            $posOrder,
            $product,
            $request->quantity(),
            $request->unitCode(),
        );

        return $this->created(new PosOrderResource($order), 'Producto agregado');
    }

    public function update(
        UpdatePosOrderItemRequest $request,
        CashRegisterSession $cashRegisterSession,
        PosOrder $posOrder,
        Productable $item,
    ): JsonResponse {
        $order = $this->saveAction->update(
            $cashRegisterSession,
            $posOrder,
            $item,
            $request->quantity(),
            $request->unitCode(),
        );

        return $this->success(new PosOrderResource($order), 'Cantidad actualizada');
    }

    public function destroy(
        CashRegisterSession $cashRegisterSession,
        PosOrder $posOrder,
        Productable $item,
    ): JsonResponse {
        $order = $this->saveAction->remove($cashRegisterSession, $posOrder, $item);

        return $this->success(new PosOrderResource($order), 'Producto retirado');
    }
}
