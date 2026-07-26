<?php

declare(strict_types=1);

use App\Models\CashRegister;
use App\Models\CashRegisterSession;
use App\Models\DocumentSeries;
use App\Models\PosOrder;
use App\Models\PriceTier;
use App\Models\Product;
use App\Models\Productable;
use App\Models\Sale;
use App\Models\Stock;
use App\Models\Store;
use App\Models\UnitOfMeasure;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

uses(RefreshDatabase::class);

function posCheckoutUrl(CashRegisterSession $session, PosOrder $order): string
{
    return "/api/v1/cash-register-sessions/{$session->id}/orders/{$order->id}/checkout";
}

/**
 * @return array{
 *     expected_total: numeric-string,
 *     payment: array{method: string, received_amount?: numeric-string, reference: string|null}
 * }
 */
function posCheckoutPayload(
    string $expectedTotal,
    string $method = 'cash',
    ?string $receivedAmount = null,
    ?string $reference = null,
): array {
    $payment = [
        'method' => $method,
        'reference' => $reference,
    ];

    if ($receivedAmount !== null) {
        $payment['received_amount'] = $receivedAmount;
    }

    return [
        'expected_total' => $expectedTotal,
        'payment' => $payment,
    ];
}

function posCheckoutCreateOrder(
    CashRegisterSession $session,
    User $creator,
    string $status = 'open',
): PosOrder {
    $latestNumber = $session->orders()->max('number');
    $number = is_numeric($latestNumber) ? ((int) $latestNumber) + 1 : 1;

    return PosOrder::query()->create([
        'cash_register_session_id' => $session->id,
        'number' => $number,
        'status' => $status,
        'subtotal' => '0.0000',
        'total' => '0.0000',
        'created_by' => $creator->id,
    ]);
}

/**
 * @param  numeric-string  $quantity
 * @param  numeric-string|null  $unitPrice
 */
function posCheckoutAddLine(
    PosOrder $order,
    Product $product,
    PriceTier $priceTier,
    string $quantity = '1.000000',
    ?string $unitPrice = null,
): Productable {
    /** @var numeric-string $resolvedUnitPrice */
    $resolvedUnitPrice = $unitPrice ?? (string) $priceTier->unit_price;
    $lineTotal = bcmul($quantity, $resolvedUnitPrice, 4);

    /** @var Productable $line */
    $line = $order->items()->create([
        'product_id' => $product->id,
        'quantity' => $quantity,
        'input_quantity' => $quantity,
        'input_unit_id' => $product->base_unit_id,
        'price_tier_id' => $priceTier->id,
        'unit_price' => $resolvedUnitPrice,
        'line_total' => $lineTotal,
    ]);

    $total = '0.0000';
    foreach ($order->items()->pluck('line_total') as $storedLineTotal) {
        if (is_numeric($storedLineTotal)) {
            /** @var numeric-string $numericLineTotal */
            $numericLineTotal = (string) $storedLineTotal;
            $total = bcadd($total, $numericLineTotal, 4);
        }
    }

    $order->update(['subtotal' => $total, 'total' => $total]);

    return $line;
}

/**
 * @return array{
 *     sales: int,
 *     payments: int,
 *     documents: int,
 *     movements: int,
 *     productables: int,
 *     stock: numeric-string,
 *     series_numbers: array<int, int>,
 *     order_status: string,
 *     order_subtotal: string,
 *     order_total: string,
 *     completed_at: mixed,
 *     completed_by: mixed
 * }
 */
function posCheckoutSnapshot(PosOrder $order, Product $product, Warehouse $warehouse): array
{
    $stock = Stock::query()
        ->where('warehouse_id', $warehouse->id)
        ->where('product_id', $product->id)
        ->firstOrFail();
    $freshOrder = $order->fresh() ?? $order;

    /** @var array<int, int> $seriesNumbers */
    $seriesNumbers = DocumentSeries::query()
        ->orderBy('id')
        ->pluck('current_number', 'id')
        ->map(static fn (mixed $number): int => (int) $number)
        ->all();

    return [
        'sales' => DB::table('sales')->count(),
        'payments' => DB::table('sale_payments')->count(),
        'documents' => DB::table('fiscal_documents')->count(),
        'movements' => DB::table('inventory_movements')->count(),
        'productables' => DB::table('productables')->count(),
        'stock' => (string) $stock->quantity,
        'series_numbers' => $seriesNumbers,
        'order_status' => (string) $freshOrder->status,
        'order_subtotal' => (string) $freshOrder->subtotal,
        'order_total' => (string) $freshOrder->total,
        'completed_at' => $freshOrder->getRawOriginal('completed_at'),
        'completed_by' => $freshOrder->getRawOriginal('completed_by'),
    ];
}

/**
 * @param array{
 *     sales: int,
 *     payments: int,
 *     documents: int,
 *     movements: int,
 *     productables: int,
 *     stock: numeric-string,
 *     series_numbers: array<int, int>,
 *     order_status: string,
 *     order_subtotal: string,
 *     order_total: string,
 *     completed_at: mixed,
 *     completed_by: mixed
 * } $snapshot
 */
function expectPosCheckoutSnapshot(
    array $snapshot,
    PosOrder $order,
    Product $product,
    Warehouse $warehouse,
): void {
    expect(posCheckoutSnapshot($order, $product, $warehouse))->toBe($snapshot);
}

beforeEach(function (): void {
    $this->user = User::factory()->create();
    grantApiPermissions($this->user, 'cash-sessions.view', 'cash-sessions.manage');
    $this->headers = [
        'Authorization' => 'Bearer '.$this->user->createToken('pos-checkout-test')->plainTextToken,
    ];
    $this->store = Store::factory()->create();
    $this->warehouse = Warehouse::factory()
        ->for($this->store)
        ->pos()
        ->create(['code' => 'POS-CHECKOUT']);
    $this->otherWarehouse = Warehouse::factory()
        ->for($this->store)
        ->retail()
        ->create(['code' => 'RETAIL-CHECKOUT']);
    $this->series = DocumentSeries::factory()->create([
        'document_type' => 'sales_ticket',
        'series_code' => 'NV99',
        'current_number' => 40,
        'is_active' => true,
    ]);
    $this->cashRegister = CashRegister::query()->create([
        'store_id' => $this->store->id,
        'warehouse_id' => $this->warehouse->id,
        'default_sales_series_id' => $this->series->id,
        'code' => 'CHECKOUT-01',
        'name' => 'Caja checkout',
        'is_active' => true,
    ]);
    $this->cashRegister->salesSeries()->attach($this->series);
    $this->session = CashRegisterSession::query()->create([
        'cash_register_id' => $this->cashRegister->id,
        'opened_by' => $this->user->id,
        'status' => 'open',
        'opening_amount' => '100.00',
        'opened_at' => now(),
    ]);
    $this->product = Product::factory()->create([
        'sku' => 'CHECKOUT-PRODUCT',
        'name' => 'Producto checkout',
    ]);
    $this->stock = Stock::factory()
        ->for($this->product)
        ->for($this->warehouse)
        ->create([
            'quantity' => '5.000000',
            'average_cost' => '2.0000',
            'total_cost' => '10.0000',
        ]);
    $this->tier = PriceTier::factory()->for($this->product)->create([
        'min_quantity' => '0.000000',
        'max_quantity' => null,
        'unit_price' => '10.0000',
        'is_active' => true,
    ]);
    $this->order = posCheckoutCreateOrder($this->session, $this->user);
    $this->line = posCheckoutAddLine($this->order, $this->product, $this->tier);
});

it('checks out a cash order and persists received amount, change and expected cash', function (): void {
    $response = $this->withHeaders($this->headers)
        ->postJson(
            posCheckoutUrl($this->session, $this->order),
            posCheckoutPayload('10.00', 'cash', '20.00'),
        );

    $response->assertCreated()
        ->assertJsonPath('data.order.id', $this->order->id)
        ->assertJsonPath('data.order.number', $this->order->number)
        ->assertJsonPath('data.order.status', 'completed')
        ->assertJsonPath('data.sale.total', '10.0000')
        ->assertJsonPath('data.sale.payable_total', '10.00')
        ->assertJsonPath('data.payment.method', 'cash')
        ->assertJsonPath('data.payment.amount', '10.00')
        ->assertJsonPath('data.payment.received_amount', '20.00')
        ->assertJsonPath('data.payment.change_amount', '10.00')
        ->assertJsonPath('data.payment.reference', null)
        ->assertJsonPath('data.fiscal_document.document_type', 'sales_ticket')
        ->assertJsonPath('data.fiscal_document.series_code', 'NV99')
        ->assertJsonPath('data.fiscal_document.number', 41);

    $saleId = $response->json('data.sale.id');
    expect($saleId)->toBeInt();

    $this->assertDatabaseHas('sales', [
        'id' => $saleId,
        'cash_register_session_id' => $this->session->id,
        'pos_order_id' => $this->order->id,
        'warehouse_id' => $this->warehouse->id,
        'total' => '10.0000',
        'payable_total' => '10.00',
    ]);
    $this->assertDatabaseHas('sale_payments', [
        'sale_id' => $saleId,
        'cash_register_session_id' => $this->session->id,
        'method' => 'cash',
        'amount' => '10.00',
        'received_amount' => '20.00',
        'change_amount' => '10.00',
        'status' => 'completed',
    ]);
    $this->assertDatabaseHas('stocks', [
        'warehouse_id' => $this->warehouse->id,
        'product_id' => $this->product->id,
        'quantity' => '4.000000',
    ]);

    $completedOrder = $this->order->fresh();
    expect($completedOrder)->not->toBeNull()
        ->and($completedOrder?->status)->toBe('completed')
        ->and($completedOrder?->completed_by)->toBe($this->user->id)
        ->and($completedOrder?->completed_at)->not->toBeNull();

    expect(DB::table('cash_register_movements')->count())->toBe(0);

    $this->withHeaders($this->headers)
        ->getJson("/api/v1/cash-register-sessions/{$this->session->id}")
        ->assertOk()
        ->assertJsonPath('data.cash_sales_total', '10.00')
        ->assertJsonPath('data.expected_amount', '110.00');
});

it('rejects cash when the received amount is insufficient without side effects', function (): void {
    $snapshot = posCheckoutSnapshot($this->order, $this->product, $this->warehouse);

    $this->withHeaders($this->headers)
        ->postJson(
            posCheckoutUrl($this->session, $this->order),
            posCheckoutPayload('10.00', 'cash', '9.99'),
        )
        ->assertUnprocessable();

    expectPosCheckoutSnapshot($snapshot, $this->order, $this->product, $this->warehouse);
});

it('validates the closed payment method list and required cash input without side effects', function (
    array $payment,
    string $errorKey,
): void {
    $snapshot = posCheckoutSnapshot($this->order, $this->product, $this->warehouse);

    $this->withHeaders($this->headers)
        ->postJson(posCheckoutUrl($this->session, $this->order), [
            'expected_total' => '10.00',
            'payment' => $payment,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors($errorKey);

    expectPosCheckoutSnapshot($snapshot, $this->order, $this->product, $this->warehouse);
})->with([
    'cash requires the received amount' => [
        ['method' => 'cash', 'reference' => null],
        'payment.received_amount',
    ],
    'unsupported method' => [
        ['method' => 'crypto', 'reference' => null],
        'payment.method',
    ],
]);

it('records an external payment without increasing physical expected cash', function (string $method): void {
    $reference = mb_strtoupper($method).'-REF-001';

    $response = $this->withHeaders($this->headers)
        ->postJson(
            posCheckoutUrl($this->session, $this->order),
            posCheckoutPayload('10.00', $method, reference: $reference),
        );

    $response->assertCreated()
        ->assertJsonPath('data.payment.method', $method)
        ->assertJsonPath('data.payment.amount', '10.00')
        ->assertJsonPath('data.payment.received_amount', null)
        ->assertJsonPath('data.payment.change_amount', '0.00')
        ->assertJsonPath('data.payment.reference', $reference);

    $this->withHeaders($this->headers)
        ->getJson("/api/v1/cash-register-sessions/{$this->session->id}")
        ->assertOk()
        ->assertJsonPath('data.cash_sales_total', '0.00')
        ->assertJsonPath('data.expected_amount', '100.00');

    expect(DB::table('cash_register_movements')->count())->toBe(0);
})->with([
    'card' => ['card'],
    'yape' => ['yape'],
    'plin' => ['plin'],
    'bank transfer' => ['bank_transfer'],
]);

it('does not accept a received cash amount for an external payment', function (): void {
    $snapshot = posCheckoutSnapshot($this->order, $this->product, $this->warehouse);

    $this->withHeaders($this->headers)
        ->postJson(
            posCheckoutUrl($this->session, $this->order),
            posCheckoutPayload('10.00', 'card', '10.00', 'CARD-001'),
        )
        ->assertUnprocessable()
        ->assertJsonValidationErrors('payment.received_amount');

    expectPosCheckoutSnapshot($snapshot, $this->order, $this->product, $this->warehouse);
});

it('derives the warehouse from the session register and allows negative stock', function (): void {
    $this->stock->update([
        'quantity' => '1.000000',
        'average_cost' => '2.0000',
        'total_cost' => '2.0000',
    ]);
    Stock::factory()
        ->for($this->product)
        ->for($this->otherWarehouse)
        ->create([
            'quantity' => '50.000000',
            'average_cost' => '3.0000',
            'total_cost' => '150.0000',
        ]);
    $this->line->update([
        'quantity' => '3.000000',
        'input_quantity' => '3.000000',
        'line_total' => '30.0000',
    ]);
    $this->order->update(['subtotal' => '30.0000', 'total' => '30.0000']);

    $response = $this->withHeaders($this->headers)
        ->postJson(
            posCheckoutUrl($this->session, $this->order),
            posCheckoutPayload('30.00', 'cash', '30.00'),
        )
        ->assertCreated()
        ->assertJsonPath('data.sale.payable_total', '30.00');

    $saleId = $response->json('data.sale.id');
    $this->assertDatabaseHas('sales', [
        'id' => $saleId,
        'warehouse_id' => $this->warehouse->id,
    ]);
    $this->assertDatabaseHas('inventory_movements', [
        'product_id' => $this->product->id,
        'warehouse_id' => $this->warehouse->id,
        'type' => 'sale',
        'quantity' => '3.000000',
        'reference_type' => Sale::class,
        'reference_id' => $saleId,
    ]);
    $this->assertDatabaseHas('stocks', [
        'warehouse_id' => $this->warehouse->id,
        'product_id' => $this->product->id,
        'quantity' => '-2.000000',
    ]);
    $this->assertDatabaseHas('stocks', [
        'warehouse_id' => $this->otherWarehouse->id,
        'product_id' => $this->product->id,
        'quantity' => '50.000000',
    ]);
});

it('keeps a measured product in its base quantity through sale and stock movement', function (): void {
    $milliliters = UnitOfMeasure::factory()->milliliters()->create();
    $measuredProduct = Product::factory()->create([
        'base_unit_id' => $milliliters->id,
        'sku' => 'CHECKOUT-VOLUME',
        'name' => 'Aceite medido',
    ]);
    Stock::factory()
        ->for($measuredProduct)
        ->for($this->warehouse)
        ->create([
            'quantity' => '2000.000000',
            'average_cost' => '0.0030',
            'total_cost' => '6.0000',
        ]);
    PriceTier::factory()->for($measuredProduct)->create([
        'min_quantity' => '0.000000',
        'max_quantity' => null,
        'unit_price' => '0.0080',
        'is_active' => true,
    ]);
    $measuredOrder = posCheckoutCreateOrder($this->session, $this->user);

    $this->withHeaders($this->headers)
        ->postJson(
            "/api/v1/cash-register-sessions/{$this->session->id}/orders/{$measuredOrder->id}/items",
            [
                'product_id' => $measuredProduct->id,
                'quantity' => '1.5',
                'unit_code' => 'L',
            ],
        )
        ->assertCreated()
        ->assertJsonPath('data.items.0.quantity', '1500.000000')
        ->assertJsonPath('data.total', '12.0000');

    $response = $this->withHeaders($this->headers)
        ->postJson(
            posCheckoutUrl($this->session, $measuredOrder),
            posCheckoutPayload('12.00', 'cash', '12.00'),
        )
        ->assertCreated();

    $saleId = $response->json('data.sale.id');
    $this->assertDatabaseHas('productables', [
        'productable_type' => Sale::class,
        'productable_id' => $saleId,
        'product_id' => $measuredProduct->id,
        'quantity' => '1500.000000',
        'input_quantity' => '1500.000000',
        'input_unit_id' => $milliliters->id,
        'line_total' => '12.0000',
    ]);
    $this->assertDatabaseHas('inventory_movements', [
        'reference_type' => Sale::class,
        'reference_id' => $saleId,
        'product_id' => $measuredProduct->id,
        'warehouse_id' => $this->warehouse->id,
        'quantity' => '1500.000000',
    ]);
    $this->assertDatabaseHas('stocks', [
        'warehouse_id' => $this->warehouse->id,
        'product_id' => $measuredProduct->id,
        'quantity' => '500.000000',
    ]);
});

it('recalculates the active price tier when checking out', function (): void {
    $this->tier->update(['unit_price' => '12.0000']);

    $response = $this->withHeaders($this->headers)
        ->postJson(
            posCheckoutUrl($this->session, $this->order),
            posCheckoutPayload('12.00', 'cash', '12.00'),
        )
        ->assertCreated()
        ->assertJsonPath('data.sale.total', '12.0000')
        ->assertJsonPath('data.sale.payable_total', '12.00');

    $saleId = $response->json('data.sale.id');
    $this->assertDatabaseHas('productables', [
        'productable_type' => Sale::class,
        'productable_id' => $saleId,
        'product_id' => $this->product->id,
        'price_tier_id' => $this->tier->id,
        'unit_price' => '12.0000',
        'line_total' => '12.0000',
    ]);
});

it('persists the payable total using half-up rounding', function (
    string $lineTotal,
    string $expectedPayable,
): void {
    $this->tier->update(['unit_price' => $lineTotal]);
    $this->line->update([
        'unit_price' => $lineTotal,
        'line_total' => $lineTotal,
    ]);
    $this->order->update(['subtotal' => $lineTotal, 'total' => $lineTotal]);

    $response = $this->withHeaders($this->headers)
        ->postJson(
            posCheckoutUrl($this->session, $this->order),
            posCheckoutPayload($expectedPayable, 'cash', $expectedPayable),
        )
        ->assertCreated()
        ->assertJsonPath('data.sale.total', $lineTotal)
        ->assertJsonPath('data.sale.payable_total', $expectedPayable)
        ->assertJsonPath('data.payment.amount', $expectedPayable)
        ->assertJsonPath('data.payment.change_amount', '0.00');

    $this->assertDatabaseHas('sales', [
        'id' => $response->json('data.sale.id'),
        'total' => $lineTotal,
        'payable_total' => $expectedPayable,
    ]);
})->with([
    '0.014 rounds down' => ['0.0140', '0.01'],
    '0.015 rounds up' => ['0.0150', '0.02'],
]);

it('returns conflict for a stale expected total without any side effects', function (): void {
    $this->tier->update(['unit_price' => '12.0000']);
    $snapshot = posCheckoutSnapshot($this->order, $this->product, $this->warehouse);

    $this->withHeaders($this->headers)
        ->postJson(
            posCheckoutUrl($this->session, $this->order),
            posCheckoutPayload('10.00', 'cash', '20.00'),
        )
        ->assertStatus(409)
        ->assertJsonPath('success', false)
        ->assertJsonPath('message', 'El total de la orden cambió. Revísalo antes de cobrar.')
        ->assertJsonPath('data.payable_total', '12.00')
        ->assertJsonPath('data.order.id', $this->order->id)
        ->assertJsonPath('data.order.status', 'open')
        ->assertJsonPath('data.order.total', '12.0000')
        ->assertJsonPath('data.order.items.0.price_tier_id', $this->tier->id)
        ->assertJsonPath('data.order.items.0.unit_price', '12.0000')
        ->assertJsonPath('data.order.items.0.line_total', '12.0000');

    expectPosCheckoutSnapshot($snapshot, $this->order, $this->product, $this->warehouse);
});

it('rejects checkout for a closed cash session', function (): void {
    $this->session->update([
        'status' => 'closed',
        'expected_amount' => '100.00',
        'counted_amount' => '100.00',
        'difference_amount' => '0.00',
        'closed_by' => $this->user->id,
        'closed_at' => now(),
    ]);
    $snapshot = posCheckoutSnapshot($this->order, $this->product, $this->warehouse);

    $this->withHeaders($this->headers)
        ->postJson(
            posCheckoutUrl($this->session, $this->order),
            posCheckoutPayload('10.00', 'cash', '10.00'),
        )
        ->assertUnprocessable();

    expectPosCheckoutSnapshot($snapshot, $this->order, $this->product, $this->warehouse);
});

it('rejects checkout for an empty order', function (): void {
    $emptyOrder = posCheckoutCreateOrder($this->session, $this->user);
    $snapshot = posCheckoutSnapshot($emptyOrder, $this->product, $this->warehouse);

    $this->withHeaders($this->headers)
        ->postJson(
            posCheckoutUrl($this->session, $emptyOrder),
            posCheckoutPayload('0.00', 'cash', '1.00'),
        )
        ->assertUnprocessable();

    expectPosCheckoutSnapshot($snapshot, $emptyOrder, $this->product, $this->warehouse);
});

it('rejects checkout for a cancelled order', function (): void {
    $this->order->update(['status' => 'cancelled']);
    $snapshot = posCheckoutSnapshot($this->order, $this->product, $this->warehouse);

    $this->withHeaders($this->headers)
        ->postJson(
            posCheckoutUrl($this->session, $this->order),
            posCheckoutPayload('10.00', 'cash', '10.00'),
        )
        ->assertUnprocessable();

    expectPosCheckoutSnapshot($snapshot, $this->order, $this->product, $this->warehouse);
});

it('rejects an order that belongs to another cash session', function (): void {
    $otherRegister = CashRegister::query()->create([
        'store_id' => $this->store->id,
        'warehouse_id' => $this->warehouse->id,
        'default_sales_series_id' => $this->series->id,
        'code' => 'CHECKOUT-02',
        'name' => 'Otra caja checkout',
        'is_active' => true,
    ]);
    $otherSession = CashRegisterSession::query()->create([
        'cash_register_id' => $otherRegister->id,
        'opened_by' => $this->user->id,
        'status' => 'open',
        'opening_amount' => '0.00',
        'opened_at' => now(),
    ]);
    $snapshot = posCheckoutSnapshot($this->order, $this->product, $this->warehouse);

    $this->withHeaders($this->headers)
        ->postJson(
            posCheckoutUrl($otherSession, $this->order),
            posCheckoutPayload('10.00', 'cash', '10.00'),
        )
        ->assertUnprocessable();

    expectPosCheckoutSnapshot($snapshot, $this->order, $this->product, $this->warehouse);
});

it('rejects a product deactivated after it was added to the order', function (): void {
    $this->product->update(['is_active' => false]);
    $snapshot = posCheckoutSnapshot($this->order, $this->product, $this->warehouse);

    $this->withHeaders($this->headers)
        ->postJson(
            posCheckoutUrl($this->session, $this->order),
            posCheckoutPayload('10.00', 'cash', '10.00'),
        )
        ->assertUnprocessable();

    expectPosCheckoutSnapshot($snapshot, $this->order, $this->product, $this->warehouse);
});

it('rejects a product with no active price tier at checkout', function (): void {
    $this->tier->update(['is_active' => false]);
    $snapshot = posCheckoutSnapshot($this->order, $this->product, $this->warehouse);

    $this->withHeaders($this->headers)
        ->postJson(
            posCheckoutUrl($this->session, $this->order),
            posCheckoutPayload('10.00', 'cash', '10.00'),
        )
        ->assertUnprocessable();

    expectPosCheckoutSnapshot($snapshot, $this->order, $this->product, $this->warehouse);
});

it('rejects an invalid default ticket series without side effects', function (Closure $mutateSeries): void {
    $mutateSeries($this);
    $snapshot = posCheckoutSnapshot($this->order, $this->product, $this->warehouse);

    $this->withHeaders($this->headers)
        ->postJson(
            posCheckoutUrl($this->session, $this->order),
            posCheckoutPayload('10.00', 'cash', '10.00'),
        )
        ->assertUnprocessable();

    expectPosCheckoutSnapshot($snapshot, $this->order, $this->product, $this->warehouse);
})->with([
    'missing default' => [
        static function (object $test): void {
            $test->cashRegister->update(['default_sales_series_id' => null]);
        },
    ],
    'inactive default' => [
        static function (object $test): void {
            $test->series->update(['is_active' => false]);
        },
    ],
    'default not assigned to the register' => [
        static function (object $test): void {
            $test->cashRegister->salesSeries()->detach($test->series);
        },
    ],
    'default has the wrong document type' => [
        static function (object $test): void {
            $receiptSeries = DocumentSeries::factory()->create([
                'document_type' => 'receipt',
                'series_code' => 'B099',
                'current_number' => 5,
                'is_active' => true,
            ]);
            $test->cashRegister->salesSeries()->attach($receiptSeries);
            $test->cashRegister->update(['default_sales_series_id' => $receiptSeries->id]);
        },
    ],
]);

it('rolls back a natural failure while processing multiple order lines', function (): void {
    $secondProduct = Product::factory()->create([
        'sku' => 'CHECKOUT-SECOND',
        'name' => 'Segundo producto checkout',
    ]);
    $secondStock = Stock::factory()
        ->for($secondProduct)
        ->for($this->warehouse)
        ->create([
            'quantity' => '5.000000',
            'average_cost' => '1.0000',
            'total_cost' => '5.0000',
        ]);
    $secondTier = PriceTier::factory()->for($secondProduct)->create([
        'min_quantity' => '0.000000',
        'max_quantity' => null,
        'unit_price' => '10.0000',
        'is_active' => true,
    ]);
    posCheckoutAddLine($this->order, $secondProduct, $secondTier);
    $secondTier->update(['is_active' => false]);

    $snapshot = posCheckoutSnapshot($this->order, $this->product, $this->warehouse);
    $secondStockBefore = (string) $secondStock->quantity;

    $this->withHeaders($this->headers)
        ->postJson(
            posCheckoutUrl($this->session, $this->order),
            posCheckoutPayload('20.00', 'cash', '20.00'),
        )
        ->assertUnprocessable();

    expectPosCheckoutSnapshot($snapshot, $this->order, $this->product, $this->warehouse);
    expect((string) $secondStock->fresh()?->quantity)->toBe($secondStockBefore);
});

it('rolls back sale, payment, stock, correlative and document on a late failure', function (): void {
    $snapshot = posCheckoutSnapshot($this->order, $this->product, $this->warehouse);
    $eventName = 'eloquent.updating: '.PosOrder::class;

    Event::listen($eventName, static function (PosOrder $order): void {
        if ($order->isDirty('status') && $order->status === 'completed') {
            throw new RuntimeException('Forced late checkout failure.');
        }
    });

    try {
        $this->withoutExceptionHandling();

        expect(fn () => $this->withHeaders($this->headers)->postJson(
            posCheckoutUrl($this->session, $this->order),
            posCheckoutPayload('10.00', 'cash', '10.00'),
        ))->toThrow(RuntimeException::class, 'Forced late checkout failure.');
    } finally {
        Event::forget($eventName);
    }

    expectPosCheckoutSnapshot($snapshot, $this->order, $this->product, $this->warehouse);
});

it('returns the same checkout on retry without duplicating any side effect', function (): void {
    $url = posCheckoutUrl($this->session, $this->order);
    $payload = posCheckoutPayload('10.00', 'cash', '20.00');

    $first = $this->withHeaders($this->headers)
        ->postJson($url, $payload)
        ->assertCreated();
    $firstSaleId = $first->json('data.sale.id');
    $firstPaymentId = DB::table('sale_payments')->value('id');
    $firstDocumentId = DB::table('fiscal_documents')->value('id');
    $firstMovementIds = DB::table('inventory_movements')->orderBy('id')->pluck('id')->all();

    $second = $this->withHeaders($this->headers)
        ->postJson($url, $payload)
        ->assertOk();

    expect($second->json('data.order.id'))->toBe($first->json('data.order.id'))
        ->and($second->json('data.sale.id'))->toBe($firstSaleId)
        ->and($second->json('data.payment'))->toBe($first->json('data.payment'))
        ->and($second->json('data.fiscal_document'))->toBe($first->json('data.fiscal_document'))
        ->and(DB::table('sale_payments')->value('id'))->toBe($firstPaymentId)
        ->and(DB::table('fiscal_documents')->value('id'))->toBe($firstDocumentId)
        ->and(DB::table('inventory_movements')->orderBy('id')->pluck('id')->all())->toBe($firstMovementIds)
        ->and(DB::table('sales')->count())->toBe(1)
        ->and(DB::table('sale_payments')->count())->toBe(1)
        ->and(DB::table('fiscal_documents')->count())->toBe(1)
        ->and(DB::table('inventory_movements')->count())->toBe(1)
        ->and(DB::table('productables')->count())->toBe(2)
        ->and((int) $this->series->fresh()?->current_number)->toBe(41)
        ->and((string) $this->stock->fresh()?->quantity)->toBe('4.000000');
});

it('returns the existing checkout when the retry arrives after the cash session was closed', function (): void {
    $url = posCheckoutUrl($this->session, $this->order);
    $payload = posCheckoutPayload('10.00', 'cash', '10.00');

    $first = $this->withHeaders($this->headers)
        ->postJson($url, $payload)
        ->assertCreated();

    $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-register-sessions/{$this->session->id}/close", [
            'counted_amount' => '110.00',
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'closed');

    $retry = $this->withHeaders($this->headers)
        ->postJson($url, $payload)
        ->assertOk();

    expect($retry->json('data.sale.id'))->toBe($first->json('data.sale.id'))
        ->and($retry->json('data.payment.id'))->toBe($first->json('data.payment.id'))
        ->and($retry->json('data.fiscal_document.id'))->toBe($first->json('data.fiscal_document.id'))
        ->and(DB::table('sales')->count())->toBe(1)
        ->and(DB::table('sale_payments')->count())->toBe(1)
        ->and(DB::table('fiscal_documents')->count())->toBe(1)
        ->and(DB::table('inventory_movements')->count())->toBe(1)
        ->and((string) $this->stock->fresh()?->quantity)->toBe('4.000000');
});

it('requires authentication for checkout', function (): void {
    $snapshot = posCheckoutSnapshot($this->order, $this->product, $this->warehouse);

    $this->postJson(
        posCheckoutUrl($this->session, $this->order),
        posCheckoutPayload('10.00', 'cash', '10.00'),
    )->assertUnauthorized();

    expectPosCheckoutSnapshot($snapshot, $this->order, $this->product, $this->warehouse);
});

it('includes completed cash sales when closing the register session', function (): void {
    $this->withHeaders($this->headers)
        ->postJson(
            posCheckoutUrl($this->session, $this->order),
            posCheckoutPayload('10.00', 'cash', '20.00'),
        )
        ->assertCreated();

    $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-register-sessions/{$this->session->id}/close", [
            'counted_amount' => '110.00',
            'closing_notes' => 'Cierre después de venta en efectivo',
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'closed')
        ->assertJsonPath('data.cash_sales_total', '10.00')
        ->assertJsonPath('data.expected_amount', '110.00')
        ->assertJsonPath('data.counted_amount', '110.00')
        ->assertJsonPath('data.difference_amount', '0.00');

    $this->assertDatabaseHas('cash_register_sessions', [
        'id' => $this->session->id,
        'status' => 'closed',
        'expected_amount' => '110.00',
        'counted_amount' => '110.00',
        'difference_amount' => '0.00',
    ]);
});
