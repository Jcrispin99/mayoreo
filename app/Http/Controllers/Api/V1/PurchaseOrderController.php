<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Purchasing\RegisterPurchaseAction;
use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\StorePurchaseOrderRequest;
use App\Http\Requests\Api\V1\UpdatePurchaseOrderRequest;
use App\Http\Resources\PurchaseOrderResource;
use App\Models\PurchaseOrder;
use App\Services\NextSequenceNumberService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class PurchaseOrderController extends ApiController
{
    private const DEFAULT_PURCHASE_SERIES = 'OC01';

    public function __construct(
        private readonly RegisterPurchaseAction $registerPurchaseAction,
        private readonly NextSequenceNumberService $nextSequenceNumberService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $orders = PurchaseOrder::query()
            ->with('items')
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->filled('warehouse_id'), fn ($query) => $query->where('warehouse_id', $request->integer('warehouse_id')))
            ->orderByDesc('id')
            ->get();

        return $this->success(PurchaseOrderResource::collection($orders));
    }

    public function store(StorePurchaseOrderRequest $request): JsonResponse
    {
        $order = DB::transaction(function () use ($request): PurchaseOrder {
            $number = $this->nextSequenceNumberService->generate('purchase', self::DEFAULT_PURCHASE_SERIES);
            $total = '0';

            foreach ($request->array('items') as $item) {
                $lineTotal = bcmul((string) $item['quantity_purchased'], (string) $item['unit_cost'], 4);
                $total = bcadd($total, $lineTotal, 4);
            }

            $order = PurchaseOrder::query()->create([
                ...$request->safe()->except('items'),
                'series_code' => self::DEFAULT_PURCHASE_SERIES,
                'number' => $number,
                'total' => $total,
                'status' => 'draft',
                'created_by' => $request->user()?->id,
            ]);

            foreach ($request->array('items') as $item) {
                $order->items()->create([
                    'product_id' => $item['product_id'],
                    'product_purchase_unit_id' => $item['product_purchase_unit_id'] ?? null,
                    'quantity_purchased' => $item['quantity_purchased'],
                    'quantity' => 0,
                    'unit_cost' => $item['unit_cost'],
                ]);
            }

            return $order;
        });

        $order->load('items');

        return $this->created(new PurchaseOrderResource($order));
    }

    public function show(PurchaseOrder $purchaseOrder): JsonResponse
    {
        $purchaseOrder->load('items');

        return $this->success(new PurchaseOrderResource($purchaseOrder));
    }

    public function update(UpdatePurchaseOrderRequest $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        if ($purchaseOrder->status !== 'draft') {
            return $this->error('Only draft purchase orders can be updated', 422);
        }

        $purchaseOrder = DB::transaction(function () use ($request, $purchaseOrder): PurchaseOrder {
            $total = '0';
            foreach ($request->array('items') as $item) {
                $lineTotal = bcmul((string) $item['quantity_purchased'], (string) $item['unit_cost'], 4);
                $total = bcadd($total, $lineTotal, 4);
            }

            $purchaseOrder->update([
                ...$request->safe()->except('items'),
                'total' => $total,
            ]);
            $purchaseOrder->items()->delete();

            foreach ($request->array('items') as $item) {
                $purchaseOrder->items()->create([
                    'product_id' => $item['product_id'],
                    'product_purchase_unit_id' => $item['product_purchase_unit_id'] ?? null,
                    'quantity_purchased' => $item['quantity_purchased'],
                    'quantity' => 0,
                    'unit_cost' => $item['unit_cost'],
                ]);
            }

            return $purchaseOrder->load('items');
        });

        return $this->success(new PurchaseOrderResource($purchaseOrder), 'Purchase order updated successfully');
    }

    public function confirm(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        if ($purchaseOrder->status !== 'draft') {
            return $this->error('Only draft purchase orders can be confirmed', 422);
        }

        $purchaseOrder = $this->registerPurchaseAction->execute($purchaseOrder, $request->user()?->id);

        return $this->success(new PurchaseOrderResource($purchaseOrder), 'Purchase order confirmed successfully');
    }
}
