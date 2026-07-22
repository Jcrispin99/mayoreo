<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Inventory\DispatchTransferAction;
use App\Actions\Inventory\ReceiveTransferAction;
use App\Exceptions\InvalidTransferRouteException;
use App\Exceptions\LocationOperationException;
use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\StoreInventoryTransferRequest;
use App\Http\Resources\InventoryTransferResource;
use App\Models\InventoryTransfer;
use App\Models\Warehouse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class InventoryTransferController extends ApiController
{
    public function __construct(
        private readonly DispatchTransferAction $dispatchTransferAction,
        private readonly ReceiveTransferAction $receiveTransferAction,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $transfers = InventoryTransfer::query()
            ->with('items')
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->orderByDesc('id')
            ->get();

        return $this->success(InventoryTransferResource::collection($transfers));
    }

    public function store(StoreInventoryTransferRequest $request): JsonResponse
    {
        $fromWarehouse = Warehouse::query()->findOrFail($request->integer('from_warehouse_id'));
        $toWarehouse = Warehouse::query()->findOrFail($request->integer('to_warehouse_id'));

        if ($fromWarehouse->id === $toWarehouse->id) {
            throw InvalidTransferRouteException::sameWarehouse($fromWarehouse->id);
        }

        if (! $fromWarehouse->is_active || ! $toWarehouse->is_active) {
            throw LocationOperationException::inactiveWarehouse();
        }

        $transfer = DB::transaction(function () use ($request, $fromWarehouse, $toWarehouse): InventoryTransfer {
            $transfer = InventoryTransfer::query()->create([
                'from_warehouse_id' => $fromWarehouse->id,
                'to_warehouse_id' => $toWarehouse->id,
                'status' => 'draft',
                'notes' => $request->input('notes'),
                'created_by' => $request->user()?->id,
            ]);

            foreach ($request->array('items') as $item) {
                $transfer->items()->create([
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'],
                ]);
            }

            return $transfer;
        });

        $transfer->load('items');

        return $this->created(new InventoryTransferResource($transfer));
    }

    public function show(InventoryTransfer $inventoryTransfer): JsonResponse
    {
        $inventoryTransfer->load('items');

        return $this->success(new InventoryTransferResource($inventoryTransfer));
    }

    public function dispatch(Request $request, InventoryTransfer $inventoryTransfer): JsonResponse
    {
        $transfer = $this->dispatchTransferAction->execute($inventoryTransfer, $request->user()?->id);

        return $this->success(new InventoryTransferResource($transfer), 'Transfer dispatched successfully');
    }

    public function receive(Request $request, InventoryTransfer $inventoryTransfer): JsonResponse
    {
        $transfer = $this->receiveTransferAction->execute($inventoryTransfer, $request->user()?->id);

        return $this->success(new InventoryTransferResource($transfer), 'Transfer received successfully');
    }
}
