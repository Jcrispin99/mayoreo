<?php

declare(strict_types=1);

use App\Models\CashRegister;
use App\Models\CashRegisterSession;
use App\Models\Customer;
use App\Models\DocumentSeries;
use App\Models\FiscalDocument;
use App\Models\PriceTier;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SalePayment;
use App\Models\Store;
use App\Models\UnitOfMeasure;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\StockLedgerService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->user = User::factory()->create();
    $this->headers = [
        'Authorization' => 'Bearer '.$this->user->createToken('accounting-test')->plainTextToken,
    ];
    $this->store = Store::factory()->create();
    $this->warehouse = Warehouse::factory()
        ->for($this->store)
        ->main()
        ->create(['code' => 'ACCOUNTING-WH']);
    $this->customer = Customer::factory()->create([
        'name' => 'Distribuidora Norte',
        'document_number' => '20600000001',
    ]);
    $this->series = DocumentSeries::factory()->create([
        'document_type' => 'sales_ticket',
        'series_code' => 'VM01',
        'current_number' => 20,
    ]);
    $this->grams = UnitOfMeasure::query()->firstOrCreate(
        ['code' => 'g'],
        ['name' => 'Gramos', 'type' => 'weight'],
    );
    $this->kilograms = UnitOfMeasure::query()->create([
        'code' => 'kg',
        'name' => 'Kilogramos',
        'type' => 'weight',
    ]);
    $this->product = Product::factory()->create([
        'base_unit_id' => $this->grams->id,
        'sku' => 'ACCOUNTING-PRODUCT',
        'name' => 'Producto a granel',
    ]);
    $this->tier = PriceTier::factory()->for($this->product)->create([
        'min_quantity' => '0.000000',
        'max_quantity' => null,
        'unit_price' => '0.0100',
        'label' => 'Mayorista',
    ]);
    app(StockLedgerService::class)->registerIn(
        $this->product,
        $this->warehouse,
        '5000.000000',
        '0.0040',
    );
});

it('completes a wholesale sale with customer, selected series, payment and converted unit', function (): void {
    $response = $this->withHeaders($this->headers)->postJson('/api/v1/sales', [
        'warehouse_id' => $this->warehouse->id,
        'customer_id' => $this->customer->id,
        'document_series_id' => $this->series->id,
        'expected_total' => '20.00',
        'notes' => 'Entregar por la tarde',
        'items' => [
            [
                'product_id' => $this->product->id,
                'quantity' => '2',
                'unit_code' => 'kg',
            ],
        ],
        'payment' => [
            'method' => 'bank_transfer',
            'reference' => 'OP-2048',
        ],
    ]);

    $response->assertCreated()
        ->assertJsonPath('data.source', 'wholesale')
        ->assertJsonPath('data.customer_id', $this->customer->id)
        ->assertJsonPath('data.customer_name', 'Distribuidora Norte')
        ->assertJsonPath('data.customer_document', '20600000001')
        ->assertJsonPath('data.notes', 'Entregar por la tarde')
        ->assertJsonPath('data.subtotal', '20.0000')
        ->assertJsonPath('data.payable_total', '20.00')
        ->assertJsonPath('data.items.0.input_quantity', '2.000000')
        ->assertJsonPath('data.items.0.quantity', '2000.000000')
        ->assertJsonPath('data.items.0.input_unit.code', 'kg')
        ->assertJsonPath('data.payments.0.method', 'bank_transfer')
        ->assertJsonPath('data.payments.0.reference', 'OP-2048')
        ->assertJsonPath('data.primary_document.full_number', 'VM01-21');

    $this->assertDatabaseHas('stocks', [
        'warehouse_id' => $this->warehouse->id,
        'product_id' => $this->product->id,
        'quantity' => '3000.000000',
    ]);
    $this->assertDatabaseHas('document_series', [
        'id' => $this->series->id,
        'current_number' => 21,
    ]);
});

it('attaches a wholesale cash payment to an open register in the same store', function (): void {
    $register = CashRegister::query()->create([
        'store_id' => $this->store->id,
        'warehouse_id' => $this->warehouse->id,
        'default_sales_series_id' => $this->series->id,
        'code' => 'ACC-CASH',
        'name' => 'Caja contabilidad',
        'is_active' => true,
    ]);
    $session = CashRegisterSession::query()->create([
        'cash_register_id' => $register->id,
        'opened_by' => $this->user->id,
        'status' => 'open',
        'opening_amount' => '100.00',
        'opened_at' => now(),
    ]);

    $this->withHeaders($this->headers)->postJson('/api/v1/sales', [
        'warehouse_id' => $this->warehouse->id,
        'customer_id' => $this->customer->id,
        'document_series_id' => $this->series->id,
        'expected_total' => '10.00',
        'items' => [
            [
                'product_id' => $this->product->id,
                'quantity' => '1',
                'unit_code' => 'kg',
            ],
        ],
        'payment' => [
            'method' => 'cash',
            'received_amount' => '20.00',
            'cash_register_session_id' => $session->id,
        ],
    ])->assertCreated()
        ->assertJsonPath('data.cash_register_session_id', $session->id)
        ->assertJsonPath('data.payments.0.received_amount', '20.00')
        ->assertJsonPath('data.payments.0.change_amount', '10.00');

    expect($session->fresh()?->cashSalesTotal())->toBe('10.00');
});

it('rolls back the wholesale sale when the expected total is stale', function (): void {
    $stockBefore = $this->product->stocks()
        ->where('warehouse_id', $this->warehouse->id)
        ->value('quantity');

    $this->withHeaders($this->headers)->postJson('/api/v1/sales', [
        'warehouse_id' => $this->warehouse->id,
        'customer_id' => $this->customer->id,
        'document_series_id' => $this->series->id,
        'expected_total' => '19.99',
        'items' => [
            [
                'product_id' => $this->product->id,
                'quantity' => '2',
                'unit_code' => 'kg',
            ],
        ],
        'payment' => [
            'method' => 'card',
        ],
    ])->assertConflict()
        ->assertJsonPath('data.payable_total', '20.00')
        ->assertJsonPath('data.items.0.quantity', '2000.000000');

    $this->assertDatabaseCount('sales', 0);
    $this->assertDatabaseCount('sale_payments', 0);
    $this->assertDatabaseCount('fiscal_documents', 0);
    expect(
        $this->product->stocks()
            ->where('warehouse_id', $this->warehouse->id)
            ->value('quantity'),
    )->toBe($stockBefore)
        ->and($this->series->fresh()?->current_number)->toBe(20);
});

it('rejects a cash payment without a valid open session for the warehouse store', function (): void {
    $otherStore = Store::factory()->create();
    $otherWarehouse = Warehouse::factory()->for($otherStore)->pos()->create();
    $register = CashRegister::query()->create([
        'store_id' => $otherStore->id,
        'warehouse_id' => $otherWarehouse->id,
        'default_sales_series_id' => $this->series->id,
        'code' => 'OTHER-CASH',
        'name' => 'Otra caja',
        'is_active' => true,
    ]);
    $session = CashRegisterSession::query()->create([
        'cash_register_id' => $register->id,
        'opened_by' => $this->user->id,
        'status' => 'open',
        'opening_amount' => '0.00',
        'opened_at' => now(),
    ]);

    $this->withHeaders($this->headers)->postJson('/api/v1/sales', [
        'warehouse_id' => $this->warehouse->id,
        'document_series_id' => $this->series->id,
        'items' => [
            ['product_id' => $this->product->id, 'quantity' => '1000'],
        ],
        'payment' => [
            'method' => 'cash',
            'received_amount' => '10.00',
            'cash_register_session_id' => $session->id,
        ],
    ])->assertUnprocessable();

    $this->assertDatabaseCount('sales', 0);
});

it('lists pos and wholesale sales together and summarizes completed sales', function (): void {
    $pos = Sale::factory()->for($this->warehouse)->create([
        'source' => 'pos',
        'customer_name' => 'Venta rápida',
        'payable_total' => '10.00',
        'subtotal' => '10.0000',
        'total' => '10.0000',
        'sold_at' => '2026-07-20 10:00:00',
    ]);
    $wholesale = Sale::factory()->for($this->warehouse)->for($this->customer)->create([
        'source' => 'wholesale',
        'customer_name' => 'Distribuidora Norte',
        'customer_document' => '20600000001',
        'payable_total' => '30.00',
        'subtotal' => '30.0000',
        'total' => '30.0000',
        'sold_at' => '2026-07-21 10:00:00',
    ]);
    Sale::factory()->for($this->warehouse)->create([
        'source' => 'wholesale',
        'status' => 'voided',
        'payable_total' => '99.00',
        'subtotal' => '99.0000',
        'total' => '99.0000',
        'sold_at' => '2026-07-21 12:00:00',
    ]);

    foreach ([[$pos, 'cash'], [$wholesale, 'bank_transfer']] as [$sale, $method]) {
        SalePayment::query()->create([
            'sale_id' => $sale->id,
            'cash_register_session_id' => null,
            'method' => $method,
            'amount' => $sale->payable_total,
            'received_amount' => null,
            'change_amount' => '0.00',
            'reference' => null,
            'status' => 'completed',
            'paid_at' => $sale->sold_at,
            'created_by' => $this->user->id,
        ]);
    }

    FiscalDocument::query()->create([
        'sale_id' => $wholesale->id,
        'document_type' => 'sales_ticket',
        'series_code' => 'VM01',
        'number' => 77,
        'status' => 'issued',
        'issued_at' => $wholesale->sold_at,
    ]);

    $this->withHeaders($this->headers)
        ->getJson('/api/v1/sales?source=wholesale&search=VM01-77')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $wholesale->id)
        ->assertJsonPath('data.0.source', 'wholesale');

    $summary = $this->withHeaders($this->headers)
        ->getJson('/api/v1/sales/summary?date_from=2026-07-20&date_to=2026-07-21')
        ->assertOk()
        ->assertJsonPath('data.totals.gross_sales', '40.00')
        ->assertJsonPath('data.totals.transactions', 2)
        ->assertJsonPath('data.totals.average_ticket', '20.00')
        ->json('data');

    expect(collect($summary['by_source'])->keyBy('source')->get('pos'))
        ->toMatchArray(['count' => 1, 'total' => '10.00'])
        ->and(collect($summary['by_source'])->keyBy('source')->get('wholesale'))
        ->toMatchArray(['count' => 1, 'total' => '30.00'])
        ->and(collect($summary['by_payment_method'])->keyBy('method')->get('bank_transfer'))
        ->toMatchArray(['count' => 1, 'total' => '30.00'])
        ->and($summary['daily'])->toHaveCount(2);
});
