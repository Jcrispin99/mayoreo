<?php

declare(strict_types=1);

namespace App\Actions\Sales;

use App\Actions\Pricing\ResolvePriceTierAction;
use App\Enums\PosPaymentMethod;
use App\Exceptions\CustomerOperationException;
use App\Exceptions\IncompatibleUnitException;
use App\Exceptions\WholesaleSaleException;
use App\Exceptions\WholesaleSaleTotalChangedException;
use App\Models\CashRegister;
use App\Models\CashRegisterSession;
use App\Models\Customer;
use App\Models\DocumentSeries;
use App\Models\FiscalDocument;
use App\Models\PriceTier;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SalePayment;
use App\Models\UnitOfMeasure;
use App\Models\Warehouse;
use App\Services\MoneyService;
use App\Services\NextSequenceNumberService;
use App\Services\StockLedgerService;
use App\Services\UnitConversionService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final readonly class CompleteWholesaleSaleAction
{
    private const TRANSACTION_ATTEMPTS = 5;

    public function __construct(
        private ResolvePriceTierAction $resolvePriceTierAction,
        private StockLedgerService $stockLedgerService,
        private NextSequenceNumberService $nextSequenceNumberService,
        private MoneyService $moneyService,
        private UnitConversionService $unitConversionService,
    ) {}

    /**
     * @param array{
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
    public function execute(array $payload, ?int $createdBy): Sale
    {
        return DB::transaction(function () use ($payload, $createdBy): Sale {
            $warehouse = Warehouse::query()
                ->whereKey($payload['warehouse_id'])
                ->where('is_active', true)
                ->lockForUpdate()
                ->first();

            if (! $warehouse instanceof Warehouse) {
                throw WholesaleSaleException::inactiveWarehouse($payload['warehouse_id']);
            }

            $customer = $this->lockCustomer($payload['customer_id'] ?? null);
            $series = $this->lockSeries($payload['document_series_id'] ?? null);
            $paymentPayload = $payload['payment'] ?? null;
            $cashSession = $this->lockCashSession($paymentPayload, $warehouse);
            $soldAt = isset($payload['sold_at'])
                ? Carbon::parse($payload['sold_at'])
                : now();

            $recalculatedItems = $this->recalculateItems($payload['items']);
            $subtotal = '0.0000';

            foreach ($recalculatedItems as $item) {
                /** @var numeric-string $subtotal */
                $subtotal = bcadd($subtotal, $item['line_total'], 4);
            }

            $payableTotal = $this->moneyService->roundHalfUp($subtotal);

            if (isset($payload['expected_total'])) {
                $expectedTotal = $this->moneyService->roundHalfUp($payload['expected_total']);

                if (bccomp($payableTotal, $expectedTotal, 2) !== 0) {
                    throw new WholesaleSaleTotalChangedException(
                        $subtotal,
                        $payableTotal,
                        array_map(
                            static fn (array $item): array => [
                                'product_id' => $item['product']->id,
                                'quantity' => $item['quantity'],
                                'price_tier_id' => $item['price_tier']->id,
                                'unit_price' => $item['unit_price'],
                                'line_total' => $item['line_total'],
                            ],
                            $recalculatedItems,
                        ),
                    );
                }
            }

            $paymentValues = $this->paymentValues($paymentPayload, $payableTotal);
            $customerName = $customer instanceof Customer
                ? $customer->name
                : ($payload['customer_name'] ?? null);
            $customerDocument = $customer instanceof Customer
                ? $customer->document_number
                : ($payload['customer_document'] ?? null);

            $sale = Sale::query()->create([
                'warehouse_id' => $warehouse->id,
                'cash_register_session_id' => $cashSession?->id,
                'pos_order_id' => null,
                'customer_id' => $customer?->id,
                'source' => 'wholesale',
                'customer_name' => $customerName,
                'customer_document' => $customerDocument,
                'notes' => $payload['notes'] ?? null,
                'status' => 'completed',
                'subtotal' => $subtotal,
                'total' => $subtotal,
                'payable_total' => $payableTotal,
                'sold_at' => $soldAt,
                'created_by' => $createdBy,
            ]);

            foreach ($recalculatedItems as $item) {
                $sale->items()->create([
                    'product_id' => $item['product']->id,
                    'quantity' => $item['quantity'],
                    'input_quantity' => $item['input_quantity'],
                    'input_unit_id' => $item['input_unit']->id,
                    'price_tier_id' => $item['price_tier']->id,
                    'unit_price' => $item['unit_price'],
                    'line_total' => $item['line_total'],
                ]);

                $this->stockLedgerService->registerOut(
                    $item['product'],
                    $warehouse,
                    $item['quantity'],
                    'sale',
                    $sale,
                    createdBy: $createdBy,
                );
            }

            if ($paymentValues !== null) {
                SalePayment::query()->create([
                    'sale_id' => $sale->id,
                    'cash_register_session_id' => $cashSession?->id,
                    'method' => $paymentValues['method'],
                    'amount' => $payableTotal,
                    'received_amount' => $paymentValues['received_amount'],
                    'change_amount' => $paymentValues['change_amount'],
                    'reference' => $paymentValues['reference'],
                    'status' => SalePayment::STATUS_COMPLETED,
                    'paid_at' => $soldAt,
                    'created_by' => $createdBy,
                ]);
            }

            $number = $this->nextSequenceNumberService->generate(
                'sales_ticket',
                $series->series_code,
            );

            FiscalDocument::query()->create([
                'sale_id' => $sale->id,
                'document_type' => 'sales_ticket',
                'series_code' => $series->series_code,
                'number' => $number,
                'status' => 'issued',
                'issued_at' => $soldAt,
            ]);

            return $sale->fresh($this->relations()) ?? $sale;
        }, self::TRANSACTION_ATTEMPTS);
    }

    private function lockCustomer(?int $customerId): ?Customer
    {
        if ($customerId === null) {
            return null;
        }

        $customer = Customer::query()->lockForUpdate()->find($customerId);

        if (! $customer instanceof Customer || ! $customer->is_active) {
            throw CustomerOperationException::inactive($customerId);
        }

        return $customer;
    }

    private function lockSeries(?int $seriesId): DocumentSeries
    {
        $query = DocumentSeries::query()
            ->where('document_type', 'sales_ticket')
            ->where('is_active', true);

        if ($seriesId !== null) {
            $query->whereKey($seriesId);
        } else {
            $query->orderBy('id');
        }

        $series = $query->lockForUpdate()->first();

        if (! $series instanceof DocumentSeries) {
            throw WholesaleSaleException::invalidSeries();
        }

        return $series;
    }

    /**
     * @param array{
     *     method: string,
     *     received_amount?: numeric-string|null,
     *     reference?: string|null,
     *     cash_register_session_id?: int|null
     * }|null $payment
     */
    private function lockCashSession(?array $payment, Warehouse $warehouse): ?CashRegisterSession
    {
        if (($payment['method'] ?? null) !== PosPaymentMethod::Cash->value) {
            return null;
        }

        $sessionId = $payment['cash_register_session_id'] ?? null;

        if ($sessionId === null) {
            throw WholesaleSaleException::cashSessionRequired();
        }

        $session = CashRegisterSession::query()
            ->whereKey($sessionId)
            ->where('status', 'open')
            ->lockForUpdate()
            ->first();

        if (! $session instanceof CashRegisterSession) {
            throw WholesaleSaleException::invalidCashSession($sessionId);
        }

        $cashRegister = CashRegister::query()
            ->whereKey($session->cash_register_id)
            ->where('store_id', $warehouse->store_id)
            ->where('is_active', true)
            ->lockForUpdate()
            ->first();

        if (! $cashRegister instanceof CashRegister) {
            throw WholesaleSaleException::invalidCashSession($sessionId);
        }

        return $session;
    }

    /**
     * @param list<array{
     *     product_id: int,
     *     quantity: float|int|string,
     *     unit_id?: int|null,
     *     unit_code?: string|null
     * }> $items
     * @return list<array{
     *     product: Product,
     *     price_tier: PriceTier,
     *     input_unit: UnitOfMeasure,
     *     input_quantity: numeric-string,
     *     quantity: numeric-string,
     *     unit_price: numeric-string,
     *     line_total: numeric-string
     * }>
     */
    private function recalculateItems(array $items): array
    {
        $sortedItems = collect($items)->sortBy('product_id')->values();
        $productIds = $sortedItems->pluck('product_id')->all();
        $products = Product::query()
            ->whereIn('id', $productIds)
            ->where('is_active', true)
            ->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->keyBy('id');
        $unitsById = $this->unitsById($sortedItems);
        $unitsByCode = $this->unitsByCode($sortedItems);
        $result = [];

        foreach ($sortedItems as $item) {
            $product = $products->get($item['product_id']);

            if (! $product instanceof Product) {
                throw WholesaleSaleException::productUnavailable($item['product_id']);
            }

            $inputQuantity = $this->normalizeQuantity($item['quantity']);
            $unitCode = $item['unit_code'] ?? null;
            $unitId = $item['unit_id'] ?? null;

            if ($unitCode !== null) {
                $inputUnit = $unitsByCode->get(mb_strtolower($unitCode));
                $quantity = $this->unitConversionService->toBaseUnitFromCode(
                    $product,
                    $inputQuantity,
                    $unitCode,
                );
            } elseif ($unitId !== null) {
                $inputUnit = $unitsById->get($unitId);

                if ((int) $unitId !== $product->base_unit_id) {
                    throw IncompatibleUnitException::unitDoesNotMatchProductBaseUnit($unitId, $product->id);
                }

                $quantity = $this->unitConversionService->toBaseUnitFromCode(
                    $product,
                    $inputQuantity,
                    null,
                );
            } else {
                $inputUnit = UnitOfMeasure::query()->find($product->base_unit_id);
                $quantity = $this->unitConversionService->toBaseUnitFromCode(
                    $product,
                    $inputQuantity,
                    null,
                );
            }

            if (! $inputUnit instanceof UnitOfMeasure) {
                throw IncompatibleUnitException::unitDoesNotMatchProductBaseUnit(
                    $unitId ?? 0,
                    $product->id,
                );
            }

            $priceTier = $this->resolvePriceTierAction->execute($product, $quantity, true);
            /** @var numeric-string $unitPrice */
            $unitPrice = (string) $priceTier->unit_price;
            /** @var numeric-string $lineTotal */
            $lineTotal = bcmul($quantity, $unitPrice, 4);

            $result[] = [
                'product' => $product,
                'price_tier' => $priceTier,
                'input_unit' => $inputUnit,
                'input_quantity' => $inputQuantity,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'line_total' => $lineTotal,
            ];
        }

        return $result;
    }

    /**
     * @param Collection<int, array{
     *     product_id: int,
     *     quantity: float|int|string,
     *     unit_id?: int|null,
     *     unit_code?: string|null
     * }> $items
     * @return Collection<int, UnitOfMeasure>
     */
    private function unitsById(Collection $items): Collection
    {
        return UnitOfMeasure::query()
            ->whereIn('id', $items->pluck('unit_id')->filter()->unique()->values())
            ->get()
            ->keyBy('id');
    }

    /**
     * @param Collection<int, array{
     *     product_id: int,
     *     quantity: float|int|string,
     *     unit_id?: int|null,
     *     unit_code?: string|null
     * }> $items
     * @return Collection<string, UnitOfMeasure>
     */
    private function unitsByCode(Collection $items): Collection
    {
        $codes = $items->pluck('unit_code')
            ->map(static fn (mixed $code): string => is_string($code) ? mb_strtolower($code) : '')
            ->filter()
            ->unique()
            ->values();

        return UnitOfMeasure::query()
            ->whereIn('code', $codes)
            ->get()
            ->keyBy(static fn (UnitOfMeasure $unit): string => mb_strtolower($unit->code));
    }

    /**
     * @return numeric-string
     */
    private function normalizeQuantity(float|int|string $quantity): string
    {
        if (is_float($quantity)) {
            $quantity = mb_rtrim(mb_rtrim(number_format($quantity, 6, '.', ''), '0'), '.');
        }

        /** @var numeric-string $numericQuantity */
        $numericQuantity = (string) $quantity;
        /** @var numeric-string $normalized */
        $normalized = bcadd($numericQuantity, '0', 6);

        return $normalized;
    }

    /**
     * @param array{
     *     method: string,
     *     received_amount?: numeric-string|null,
     *     reference?: string|null,
     *     cash_register_session_id?: int|null
     * }|null $payment
     * @param  numeric-string  $payableTotal
     * @return array{
     *     method: string,
     *     received_amount: numeric-string|null,
     *     change_amount: numeric-string,
     *     reference: string|null
     * }|null
     */
    private function paymentValues(?array $payment, string $payableTotal): ?array
    {
        if ($payment === null) {
            return null;
        }

        $method = PosPaymentMethod::tryFrom($payment['method']);

        if (! $method instanceof PosPaymentMethod) {
            throw WholesaleSaleException::unsupportedPaymentMethod($payment['method']);
        }

        $receivedAmount = $payment['received_amount'] ?? null;

        if (! $method->requiresReceivedAmount()) {
            if ($receivedAmount !== null) {
                throw WholesaleSaleException::unexpectedReceivedAmount($method->value);
            }

            return [
                'method' => $method->value,
                'received_amount' => null,
                'change_amount' => '0.00',
                'reference' => $payment['reference'] ?? null,
            ];
        }

        if ($receivedAmount === null) {
            throw WholesaleSaleException::cashReceivedRequired();
        }

        /** @var numeric-string $receivedAmount */
        $normalizedReceived = $this->moneyService->roundHalfUp($receivedAmount);

        if (bccomp($normalizedReceived, $payableTotal, 2) < 0) {
            throw WholesaleSaleException::insufficientCash($normalizedReceived, $payableTotal);
        }

        /** @var numeric-string $change */
        $change = bcsub($normalizedReceived, $payableTotal, 2);

        return [
            'method' => $method->value,
            'received_amount' => $normalizedReceived,
            'change_amount' => $change,
            'reference' => null,
        ];
    }

    /** @return list<string> */
    private function relations(): array
    {
        return [
            'items.product.baseUnit',
            'items.inputUnit',
            'items.priceTier',
            'payments',
            'fiscalDocuments',
            'warehouse.store',
            'customer',
            'creator',
            'cashRegisterSession.cashRegister',
        ];
    }
}
