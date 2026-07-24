<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Sales\CompleteWholesaleSaleAction;
use App\Enums\PosPaymentMethod;
use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\StoreSaleRequest;
use App\Http\Resources\SaleResource;
use App\Models\Sale;
use App\Models\SalePayment;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class SaleController extends ApiController
{
    public function __construct(
        private readonly CompleteWholesaleSaleAction $completeWholesaleSaleAction,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $this->validatedFilters($request, true);
        $sales = $this->filteredQuery($filters)
            ->with($this->relations())
            ->orderByDesc('sold_at')
            ->orderByDesc('id')
            ->get();

        return $this->success(SaleResource::collection($sales));
    }

    public function store(StoreSaleRequest $request): JsonResponse
    {
        /** @var array{
         *     warehouse_id: int,
         *     customer_id?: int|null,
         *     document_series_id?: int|null,
         *     customer_name?: string|null,
         *     customer_document?: string|null,
         *     sold_at?: string|null,
         *     expected_total?: numeric-string|null,
         *     notes?: string|null,
         *     items: list<array{
         *         product_id: int,
         *         quantity: float|int|string,
         *         unit_id?: int|null,
         *         unit_code?: string|null
         *     }>,
         *     payment?: array{
         *         method: string,
         *         received_amount?: numeric-string|null,
         *         reference?: string|null,
         *         cash_register_session_id?: int|null
         *     }
         * } $payload
         */
        $payload = $request->validated();
        $sale = $this->completeWholesaleSaleAction->execute(
            $payload,
            $request->user()?->id,
        );

        return $this->created(new SaleResource($sale));
    }

    public function show(Sale $sale): JsonResponse
    {
        $sale->load($this->relations());

        return $this->success(new SaleResource($sale));
    }

    public function summary(Request $request): JsonResponse
    {
        $filters = $this->validatedFilters($request, false);
        $sales = $this->filteredQuery($filters)
            ->where('status', 'completed')
            ->with('payments')
            ->orderBy('sold_at')
            ->get();
        $grossSales = '0.00';
        $bySource = [
            'pos' => ['source' => 'pos', 'count' => 0, 'total' => '0.00'],
            'wholesale' => ['source' => 'wholesale', 'count' => 0, 'total' => '0.00'],
        ];
        $byPayment = [];
        $daily = [];

        foreach ($sales as $sale) {
            /** @var numeric-string $saleTotal */
            $saleTotal = (string) $sale->payable_total;
            /** @var numeric-string $grossSales */
            $grossSales = bcadd($grossSales, $saleTotal, 2);

            if (! array_key_exists($sale->source, $bySource)) {
                $bySource[$sale->source] = [
                    'source' => $sale->source,
                    'count' => 0,
                    'total' => '0.00',
                ];
            }

            $bySource[$sale->source]['count']++;
            $bySource[$sale->source]['total'] = bcadd(
                $bySource[$sale->source]['total'],
                $saleTotal,
                2,
            );

            $payment = $sale->payments->first();
            $method = $payment instanceof SalePayment ? $payment->method : 'unpaid';
            $byPayment[$method] ??= [
                'method' => $method,
                'count' => 0,
                'total' => '0.00',
            ];
            $byPayment[$method]['count']++;
            $byPayment[$method]['total'] = bcadd(
                $byPayment[$method]['total'],
                $saleTotal,
                2,
            );

            $date = $sale->sold_at->toDateString();
            $daily[$date] ??= [
                'date' => $date,
                'count' => 0,
                'total' => '0.00',
            ];
            $daily[$date]['count']++;
            $daily[$date]['total'] = bcadd($daily[$date]['total'], $saleTotal, 2);
        }

        $transactionCount = $sales->count();
        $averageTicket = $transactionCount > 0
            ? $this->divideMoney($grossSales, $transactionCount)
            : '0.00';

        return $this->success([
            'totals' => [
                'gross_sales' => $grossSales,
                'transactions' => $transactionCount,
                'average_ticket' => $averageTicket,
            ],
            'by_source' => array_values($bySource),
            'by_payment_method' => array_values($byPayment),
            'daily' => array_values($daily),
        ]);
    }

    /**
     * @return array{
     *     warehouse_id?: int,
     *     customer_id?: int,
     *     source?: string,
     *     status?: string,
     *     payment_method?: string,
     *     date_from?: string,
     *     date_to?: string,
     *     search?: string
     * }
     */
    private function validatedFilters(Request $request, bool $includeSearch): array
    {
        $rules = [
            'warehouse_id' => ['sometimes', 'integer', 'exists:warehouses,id'],
            'customer_id' => ['sometimes', 'integer', 'exists:customers,id'],
            'source' => ['sometimes', 'string', Rule::in(['pos', 'wholesale'])],
            'status' => ['sometimes', 'string', Rule::in(['completed', 'voided'])],
            'payment_method' => ['sometimes', 'string', Rule::enum(PosPaymentMethod::class)],
            'date_from' => ['sometimes', 'date'],
            'date_to' => ['sometimes', 'date', 'after_or_equal:date_from'],
        ];

        if ($includeSearch) {
            $rules['search'] = ['sometimes', 'string', 'max:100'];
        }

        /** @var array{
         *     warehouse_id?: int,
         *     customer_id?: int,
         *     source?: string,
         *     status?: string,
         *     payment_method?: string,
         *     date_from?: string,
         *     date_to?: string,
         *     search?: string
         * } $validated
         */
        $validated = $request->validate($rules);

        return $validated;
    }

    /**
     * @param array{
     *     warehouse_id?: int,
     *     customer_id?: int,
     *     source?: string,
     *     status?: string,
     *     payment_method?: string,
     *     date_from?: string,
     *     date_to?: string,
     *     search?: string
     * } $filters
     * @return Builder<Sale>
     */
    private function filteredQuery(array $filters): Builder
    {
        $query = Sale::query();

        if (isset($filters['warehouse_id'])) {
            $query->where('warehouse_id', $filters['warehouse_id']);
        }

        if (isset($filters['customer_id'])) {
            $query->where('customer_id', $filters['customer_id']);
        }

        if (isset($filters['source'])) {
            $query->where('source', $filters['source']);
        }

        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (isset($filters['payment_method'])) {
            $paymentMethod = $filters['payment_method'];
            $query->whereHas(
                'payments',
                fn (Builder $paymentQuery): Builder => $paymentQuery->where('method', $paymentMethod),
            );
        }

        if (isset($filters['date_from'])) {
            $query->whereDate('sold_at', '>=', $filters['date_from']);
        }

        if (isset($filters['date_to'])) {
            $query->whereDate('sold_at', '<=', $filters['date_to']);
        }

        if (isset($filters['search'])) {
            $term = $filters['search'];
            $search = '%'.$term.'%';
            $documentParts = explode('-', $term, 2);

            $query->where(function (Builder $searchQuery) use ($search, $documentParts): void {
                $searchQuery
                    ->where('customer_name', 'like', $search)
                    ->orWhere('customer_document', 'like', $search)
                    ->orWhereHas('fiscalDocuments', function (Builder $documentQuery) use ($search, $documentParts): void {
                        $documentQuery
                            ->where('series_code', 'like', $search)
                            ->orWhere('number', 'like', $search);

                        if (count($documentParts) === 2) {
                            $documentQuery->orWhere(function (Builder $fullNumberQuery) use ($documentParts): void {
                                $fullNumberQuery
                                    ->where('series_code', $documentParts[0])
                                    ->where('number', 'like', '%'.$documentParts[1].'%');
                            });
                        }
                    });
            });
        }

        return $query;
    }

    /** @return list<string> */
    private function relations(): array
    {
        return [
            'items.product.baseUnit',
            'items.inputUnit',
            'items.priceTier',
            'payments.creator',
            'fiscalDocuments',
            'warehouse.store',
            'customer',
            'creator',
            'cashRegisterSession.cashRegister',
        ];
    }

    /** @param numeric-string $amount */
    private function divideMoney(string $amount, int $divisor): string
    {
        /** @var numeric-string $average */
        $average = bcdiv($amount, (string) $divisor, 4);
        /** @var numeric-string $rounded */
        $rounded = bcadd($average, '0.005', 2);

        return $rounded;
    }
}
