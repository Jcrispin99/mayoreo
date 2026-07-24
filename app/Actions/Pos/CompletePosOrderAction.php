<?php

declare(strict_types=1);

namespace App\Actions\Pos;

use App\Actions\Pricing\ResolvePriceTierAction;
use App\Enums\PosPaymentMethod;
use App\Exceptions\CashRegisterSessionException;
use App\Exceptions\PosCheckoutException;
use App\Exceptions\PosCheckoutTotalChangedException;
use App\Exceptions\PosOrderException;
use App\Models\CashRegister;
use App\Models\CashRegisterSession;
use App\Models\DocumentSeries;
use App\Models\FiscalDocument;
use App\Models\PosOrder;
use App\Models\PriceTier;
use App\Models\Product;
use App\Models\Productable;
use App\Models\Sale;
use App\Models\SalePayment;
use App\Models\Warehouse;
use App\Services\MoneyService;
use App\Services\NextSequenceNumberService;
use App\Services\StockLedgerService;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\DB;

final readonly class CompletePosOrderAction
{
    private const TRANSACTION_ATTEMPTS = 5;

    public function __construct(
        private ResolvePriceTierAction $resolvePriceTierAction,
        private StockLedgerService $stockLedgerService,
        private NextSequenceNumberService $nextSequenceNumberService,
        private MoneyService $moneyService,
    ) {}

    /**
     * @param  numeric-string  $expectedTotal
     * @param  numeric-string|null  $receivedAmount
     */
    public function execute(
        CashRegisterSession $session,
        PosOrder $order,
        string $expectedTotal,
        string $paymentMethod,
        ?string $receivedAmount,
        ?string $reference,
        ?int $completedBy,
    ): CompletePosOrderResult {
        return DB::transaction(function () use (
            $session,
            $order,
            $expectedTotal,
            $paymentMethod,
            $receivedAmount,
            $reference,
            $completedBy,
        ): CompletePosOrderResult {
            $lockedSession = CashRegisterSession::query()
                ->lockForUpdate()
                ->findOrFail($session->id);

            $lockedOrder = PosOrder::query()
                ->where('cash_register_session_id', $lockedSession->id)
                ->lockForUpdate()
                ->find($order->id);

            if (! $lockedOrder instanceof PosOrder) {
                throw PosOrderException::doesNotBelongToSession();
            }

            $existingSale = Sale::query()
                ->where('pos_order_id', $lockedOrder->id)
                ->lockForUpdate()
                ->first();

            if ($existingSale instanceof Sale) {
                return $this->existingResult($lockedOrder, $existingSale);
            }

            if ($lockedSession->status !== 'open') {
                throw CashRegisterSessionException::alreadyClosed($lockedSession->id);
            }

            if ($lockedOrder->status !== 'open') {
                throw PosOrderException::notOpen($lockedOrder->id);
            }

            $items = $lockedOrder->items()
                ->orderBy('product_id')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();

            if ($items->isEmpty()) {
                throw PosCheckoutException::emptyOrder($lockedOrder->id);
            }

            $cashRegister = CashRegister::query()
                ->lockForUpdate()
                ->findOrFail($lockedSession->cash_register_id);

            $warehouse = Warehouse::query()
                ->whereKey($cashRegister->warehouse_id)
                ->where('store_id', $cashRegister->store_id)
                ->first();

            if (! $warehouse instanceof Warehouse) {
                throw PosCheckoutException::invalidWarehouse($cashRegister->id);
            }

            $productIds = $items->pluck('product_id')->unique()->values();
            $products = Product::query()
                ->whereIn('id', $productIds)
                ->where('is_active', true)
                ->whereHas('stocks.warehouse', function (Builder $query) use ($cashRegister): void {
                    $query->where('store_id', $cashRegister->store_id);
                })
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $products->load([
                'baseUnit',
                'priceTiers' => function (Relation $relation): void {
                    $relation->getQuery()->where('is_active', true)->orderBy('min_quantity');
                },
            ]);

            /**
             * @var list<array{
             *     item: Productable,
             *     product: Product,
             *     priceTier: PriceTier,
             *     unitPrice: numeric-string,
             *     lineTotal: numeric-string
             * }> $recalculatedItems
             */
            $recalculatedItems = [];
            $subtotal = '0.0000';

            foreach ($items as $item) {
                $product = $products->get($item->product_id);

                if (! $product instanceof Product) {
                    throw PosOrderException::productUnavailable($item->product_id);
                }

                /** @var numeric-string $quantity */
                $quantity = (string) $item->quantity;
                $priceTier = $this->resolvePriceTierAction->execute($product, $quantity, true);
                /** @var numeric-string $unitPrice */
                $unitPrice = (string) $priceTier->unit_price;
                /** @var numeric-string $lineTotal */
                $lineTotal = bcmul($quantity, $unitPrice, 4);
                /** @var numeric-string $subtotal */
                $subtotal = bcadd($subtotal, $lineTotal, 4);

                $item->setAttribute('price_tier_id', $priceTier->id);
                $item->setAttribute('unit_price', $unitPrice);
                $item->setAttribute('line_total', $lineTotal);
                $item->setRelation('product', $product);

                $recalculatedItems[] = [
                    'item' => $item,
                    'product' => $product,
                    'priceTier' => $priceTier,
                    'unitPrice' => $unitPrice,
                    'lineTotal' => $lineTotal,
                ];
            }

            $lockedOrder->setAttribute('subtotal', $subtotal);
            $lockedOrder->setAttribute('total', $subtotal);
            $lockedOrder->setRelation('items', $items);

            $payableTotal = $this->moneyService->roundHalfUp($subtotal);
            $normalizedExpectedTotal = $this->moneyService->roundHalfUp($expectedTotal);

            if (bccomp($payableTotal, $normalizedExpectedTotal, 2) !== 0) {
                throw new PosCheckoutTotalChangedException($lockedOrder, $payableTotal);
            }

            [$normalizedReceivedAmount, $changeAmount, $normalizedReference] = $this->paymentValues(
                $paymentMethod,
                $receivedAmount,
                $reference,
                $payableTotal,
            );

            $series = $this->lockSalesTicketSeries($cashRegister);
            $completedAt = now();

            $sale = Sale::query()->create([
                'warehouse_id' => $warehouse->id,
                'cash_register_session_id' => $lockedSession->id,
                'pos_order_id' => $lockedOrder->id,
                'customer_id' => null,
                'source' => 'pos',
                'customer_name' => null,
                'customer_document' => null,
                'notes' => null,
                'status' => 'completed',
                'subtotal' => $subtotal,
                'total' => $subtotal,
                'payable_total' => $payableTotal,
                'sold_at' => $completedAt,
                'created_by' => $completedBy,
            ]);

            foreach ($recalculatedItems as $recalculatedItem) {
                $item = $recalculatedItem['item'];
                $product = $recalculatedItem['product'];
                $item->save();

                $sale->items()->create([
                    'product_id' => $product->id,
                    'quantity' => $item->quantity,
                    'input_quantity' => $item->input_quantity,
                    'input_unit_id' => $item->input_unit_id,
                    'price_tier_id' => $recalculatedItem['priceTier']->id,
                    'unit_price' => $recalculatedItem['unitPrice'],
                    'line_total' => $recalculatedItem['lineTotal'],
                ]);

                /** @var numeric-string $quantity */
                $quantity = (string) $item->quantity;
                $this->stockLedgerService->registerOut(
                    $product,
                    $warehouse,
                    $quantity,
                    'sale',
                    $sale,
                    createdBy: $completedBy,
                );
            }

            $payment = SalePayment::query()->create([
                'sale_id' => $sale->id,
                'cash_register_session_id' => $lockedSession->id,
                'method' => $paymentMethod,
                'amount' => $payableTotal,
                'received_amount' => $normalizedReceivedAmount,
                'change_amount' => $changeAmount,
                'reference' => $normalizedReference,
                'status' => 'completed',
                'paid_at' => $completedAt,
                'created_by' => $completedBy,
            ]);

            $number = $this->nextSequenceNumberService->generate(
                'sales_ticket',
                $series->series_code,
            );

            $fiscalDocument = FiscalDocument::query()->create([
                'sale_id' => $sale->id,
                'document_type' => 'sales_ticket',
                'series_code' => $series->series_code,
                'number' => $number,
                'status' => 'issued',
                'issued_at' => $completedAt,
            ]);

            $lockedOrder->update([
                'status' => 'completed',
                'subtotal' => $subtotal,
                'total' => $subtotal,
                'completed_at' => $completedAt,
                'completed_by' => $completedBy,
            ]);

            $freshOrder = $lockedOrder->fresh($this->orderRelations()) ?? $lockedOrder;
            $freshSale = $sale->fresh(['items', 'payments', 'fiscalDocuments']) ?? $sale;

            return new CompletePosOrderResult(
                $freshOrder,
                $freshSale,
                $payment->refresh(),
                $fiscalDocument->refresh(),
                true,
            );
        }, self::TRANSACTION_ATTEMPTS);
    }

    private function existingResult(PosOrder $order, Sale $sale): CompletePosOrderResult
    {
        $sale->load(['items', 'payments', 'fiscalDocuments']);
        $payment = $sale->payments->first();
        $fiscalDocument = $sale->fiscalDocuments
            ->firstWhere('document_type', 'sales_ticket');

        if (! $payment instanceof SalePayment || ! $fiscalDocument instanceof FiscalDocument) {
            throw PosCheckoutException::incompleteExistingSale($sale->id);
        }

        $freshOrder = $order->fresh($this->orderRelations()) ?? $order;

        return new CompletePosOrderResult(
            $freshOrder,
            $sale,
            $payment,
            $fiscalDocument,
            false,
        );
    }

    /**
     * @param  numeric-string|null  $receivedAmount
     * @param  numeric-string  $payableTotal
     * @return array{numeric-string|null, numeric-string, string|null}
     */
    private function paymentValues(
        string $paymentMethod,
        ?string $receivedAmount,
        ?string $reference,
        string $payableTotal,
    ): array {
        $method = PosPaymentMethod::tryFrom($paymentMethod);

        if (! $method instanceof PosPaymentMethod) {
            throw PosCheckoutException::unsupportedPaymentMethod($paymentMethod);
        }

        if (! $method->requiresReceivedAmount()) {
            if ($receivedAmount !== null) {
                throw PosCheckoutException::unexpectedReceivedAmount($paymentMethod);
            }

            return [null, '0.00', $reference];
        }

        if ($receivedAmount === null) {
            throw PosCheckoutException::cashReceivedRequired();
        }

        $normalizedReceivedAmount = $this->moneyService->roundHalfUp($receivedAmount);

        if (bccomp($normalizedReceivedAmount, $payableTotal, 2) < 0) {
            throw PosCheckoutException::insufficientCash($normalizedReceivedAmount, $payableTotal);
        }

        /** @var numeric-string $changeAmount */
        $changeAmount = bcsub($normalizedReceivedAmount, $payableTotal, 2);

        return [$normalizedReceivedAmount, $changeAmount, null];
    }

    private function lockSalesTicketSeries(CashRegister $cashRegister): DocumentSeries
    {
        $series = DocumentSeries::query()
            ->whereKey($cashRegister->default_sales_series_id)
            ->where('document_type', 'sales_ticket')
            ->where('is_active', true)
            ->whereHas('cashRegisters', function (Builder $query) use ($cashRegister): void {
                $query->where('cash_registers.id', $cashRegister->id);
            })
            ->lockForUpdate()
            ->first();

        if (! $series instanceof DocumentSeries) {
            throw PosCheckoutException::invalidDefaultSeries($cashRegister->id);
        }

        return $series;
    }

    /** @return array<int|string, Closure|string> */
    private function orderRelations(): array
    {
        return [
            'items.product.baseUnit',
            'items.product.priceTiers' => function (Relation $relation): void {
                $relation->getQuery()->where('is_active', true)->orderBy('min_quantity');
            },
        ];
    }
}
