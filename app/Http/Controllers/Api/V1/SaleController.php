<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Sales\RegisterSaleAction;
use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\StoreSaleRequest;
use App\Http\Resources\SaleResource;
use App\Models\Sale;
use App\Models\Warehouse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SaleController extends ApiController
{
    public function __construct(
        private readonly RegisterSaleAction $registerSaleAction,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $sales = Sale::query()
            ->with(['items', 'fiscalDocuments'])
            ->when($request->filled('warehouse_id'), fn ($query) => $query->where('warehouse_id', $request->integer('warehouse_id')))
            ->orderByDesc('id')
            ->get();

        return $this->success(SaleResource::collection($sales));
    }

    public function store(StoreSaleRequest $request): JsonResponse
    {
        $warehouse = Warehouse::query()->findOrFail($request->integer('warehouse_id'));

        $sale = $this->registerSaleAction->execute(
            $warehouse,
            $request->array('items'),
            $request->string('customer_name')->toString() ?: null,
            $request->string('customer_document')->toString() ?: null,
            $request->user()?->id,
        );

        return $this->created(new SaleResource($sale));
    }

    public function show(Sale $sale): JsonResponse
    {
        $sale->load(['items', 'fiscalDocuments']);

        return $this->success(new SaleResource($sale));
    }
}
