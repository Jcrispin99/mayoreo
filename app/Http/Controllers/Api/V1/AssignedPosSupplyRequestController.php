<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Inventory\ResolveInventoryTransferAction;
use App\Http\Controllers\Api\ApiController;
use App\Http\Resources\InventoryTransferResource;
use App\Models\InventoryTransfer;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AssignedPosSupplyRequestController extends ApiController
{
    public function __construct(
        private readonly ResolveInventoryTransferAction $resolveTransferAction,
    ) {}

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $transfers = InventoryTransfer::query()
            ->whereNotNull('pos_order_id')
            ->where('assigned_to', $user->id)
            ->with([
                'items.product.baseUnit',
                'fromWarehouse.store',
                'toWarehouse.store',
                'posOrder.cashRegisterSession.cashRegister',
                'assignee',
            ])
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->orderByDesc('id')
            ->get();

        return $this->success(InventoryTransferResource::collection($transfers));
    }

    public function resolve(Request $request, InventoryTransfer $inventoryTransfer): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        abort_unless(
            $inventoryTransfer->pos_order_id !== null
            && $inventoryTransfer->assigned_to === $user->id
            && $user->hasRole('warehouse'),
            403,
            'Esta comanda está asignada a otro usuario de almacén.',
        );

        $transfer = $this->resolveTransferAction->execute($inventoryTransfer, $user->id);

        return $this->success(
            new InventoryTransferResource($transfer->load(['items.product.baseUnit', 'assignee'])),
            'Comanda lista, stock repuesto',
        );
    }
}
