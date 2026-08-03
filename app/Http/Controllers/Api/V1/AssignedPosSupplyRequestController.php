<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Pos\ManagePosSupplyPreparationAction;
use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\UpdatePosSupplyRequestItemRequest;
use App\Http\Requests\Api\V1\VersionedPosSupplyRequest;
use App\Http\Resources\PosSupplyRequestResource;
use App\Models\PosSupplyRequest;
use App\Models\PosSupplyRequestItem;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AssignedPosSupplyRequestController extends ApiController
{
    public function __construct(
        private readonly ManagePosSupplyPreparationAction $preparationAction,
    ) {}

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $requests = PosSupplyRequest::query()
            ->where('assigned_to', $user->id)
            ->with([
                'items.product.baseUnit',
                'fromWarehouse.store',
                'toWarehouse.store',
                'posOrder.cashRegisterSession.cashRegister',
                'assignee',
            ])
            ->when(
                $request->filled('status'),
                fn ($query) => $query->where('status', $request->string('status')),
                fn ($query) => $query->whereNotIn('status', ['delivered', 'cancelled']),
            )
            ->orderByDesc('id')
            ->get();

        return $this->success(PosSupplyRequestResource::collection($requests));
    }

    public function acknowledge(
        VersionedPosSupplyRequest $request,
        PosSupplyRequest $posSupplyRequest,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();
        $updated = $this->preparationAction->acknowledge(
            $posSupplyRequest,
            $user,
            $request->expectedVersion(),
        );

        return $this->success(new PosSupplyRequestResource($updated), 'Cambios revisados');
    }

    public function updateItem(
        UpdatePosSupplyRequestItemRequest $request,
        PosSupplyRequest $posSupplyRequest,
        PosSupplyRequestItem $item,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();
        $updated = $this->preparationAction->updateItem(
            $posSupplyRequest,
            $item,
            $user,
            $request->expectedVersion(),
            $request->preparedQuantity(),
        );

        return $this->success(new PosSupplyRequestResource($updated), 'Preparación actualizada');
    }

    public function ready(
        VersionedPosSupplyRequest $request,
        PosSupplyRequest $posSupplyRequest,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();
        $updated = $this->preparationAction->markReady(
            $posSupplyRequest,
            $user,
            $request->expectedVersion(),
        );

        return $this->success(new PosSupplyRequestResource($updated), 'Pedido listo para entregar');
    }
}
