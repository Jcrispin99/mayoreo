<?php

declare(strict_types=1);

use App\Models\CashRegister;
use App\Models\CashRegisterSession;
use App\Models\DocumentSeries;
use App\Models\PosOrder;
use App\Models\PosSupplyRequest;
use App\Models\PriceTier;
use App\Models\Product;
use App\Models\Stock;
use App\Models\Store;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\StockLedgerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->cashier = User::factory()->create();
    grantApiPermissions($this->cashier, 'cash-sessions.view', 'cash-sessions.manage', 'pos-supply-requests.assign');
    $this->cashierHeaders = ['Authorization' => 'Bearer '.$this->cashier->createToken('cashier')->plainTextToken];

    $this->warehouseOperator = User::factory()->create();
    Role::findOrCreate('warehouse', 'web');
    $this->warehouseOperator->assignRole('warehouse');
    grantApiPermissions(
        $this->warehouseOperator,
        'pos-supply-requests.view-assigned',
        'pos-supply-requests.prepare-assigned',
    );
    $this->operatorHeaders = ['Authorization' => 'Bearer '.$this->warehouseOperator->createToken('operator')->plainTextToken];

    $this->store = Store::factory()->create();
    $this->main = Warehouse::factory()->for($this->store)->main()->create();
    $this->pos = Warehouse::factory()->for($this->store)->pos()->create();

    $this->series = DocumentSeries::factory()->create([
        'document_type' => 'sales_ticket',
        'series_code' => 'NV01',
        'current_number' => 0,
        'is_active' => true,
    ]);
    $this->cashRegister = CashRegister::query()->create([
        'store_id' => $this->store->id,
        'warehouse_id' => $this->pos->id,
        'default_sales_series_id' => $this->series->id,
        'code' => 'CAJA-01',
        'name' => 'Caja 1',
        'is_active' => true,
    ]);
    $this->cashRegister->salesSeries()->attach($this->series);
    $this->session = CashRegisterSession::query()->create([
        'cash_register_id' => $this->cashRegister->id,
        'opened_by' => $this->cashier->id,
        'status' => 'open',
        'opening_amount' => '0.00',
        'opened_at' => now(),
    ]);

    $this->product = Product::factory()->create();
    app(StockLedgerService::class)->registerIn($this->product, $this->main, '100.000000', '2.0000', 'purchase');
    Stock::factory()->for($this->product)->for($this->pos)->create([
        'quantity' => '0.000000',
        'average_cost' => '0.0000',
        'total_cost' => '0.0000',
    ]);

    $this->tier = PriceTier::factory()->for($this->product)->create([
        'min_quantity' => '0.000000',
        'max_quantity' => null,
        'unit_price' => '10.0000',
        'is_active' => true,
    ]);

    $this->order = PosOrder::query()->create([
        'cash_register_session_id' => $this->session->id,
        'number' => 1,
        'status' => 'open',
        'subtotal' => '0.0000',
        'total' => '0.0000',
        'created_by' => $this->cashier->id,
    ]);
    $this->order->items()->create([
        'product_id' => $this->product->id,
        'quantity' => '5.000000',
        'input_quantity' => '5.000000',
        'input_unit_id' => $this->product->base_unit_id,
        'price_tier_id' => $this->tier->id,
        'unit_price' => '10.0000',
        'line_total' => '50.0000',
    ]);
    $this->order->update(['subtotal' => '50.0000', 'total' => '50.0000']);
});

function supplyRequestUrl(CashRegisterSession $session, PosOrder $order): string
{
    return "/api/v1/cash-register-sessions/{$session->id}/orders/{$order->id}/supply-requests";
}

/** @param array<string, string> $headers */
function asActor(Tests\TestCase $test, array $headers): Tests\TestCase
{
    app('auth')->forgetGuards();

    return $test->withHeaders($headers);
}

/** @return array<string, mixed> */
function createSupplyRequest(Tests\TestCase $test): array
{
    return asActor($test, $test->cashierHeaders)
        ->postJson(supplyRequestUrl($test->session, $test->order), [
            'assigned_to' => $test->warehouseOperator->id,
        ])
        ->assertCreated()
        ->json('data');
}

it('runs the preparation and physical delivery cycle before allowing checkout', function (): void {
    $request = createSupplyRequest($this);

    expect($request['status'])->toBe('assigned')
        ->and($request['version'])->toBe(1)
        ->and($request['acknowledged_version'])->toBe(0)
        ->and($request['items'][0]['requested_quantity'])->toBe('5.000000');

    $this->assertDatabaseCount('inventory_transfers', 0);
    $this->assertDatabaseHas('stocks', [
        'warehouse_id' => $this->pos->id,
        'product_id' => $this->product->id,
        'quantity' => '0.000000',
    ]);

    asActor($this, $this->cashierHeaders)
        ->postJson(
            "/api/v1/cash-register-sessions/{$this->session->id}/orders/{$this->order->id}/checkout",
            [
                'expected_total' => '50.00',
                'payment' => ['method' => 'cash', 'received_amount' => '50.00', 'reference' => null],
            ],
        )
        ->assertUnprocessable();

    asActor($this, $this->operatorHeaders)
        ->postJson("/api/v1/warehouse/supply-requests/{$request['id']}/acknowledge", ['expected_version' => 1])
        ->assertOk()
        ->assertJsonPath('data.status', 'preparing')
        ->assertJsonPath('data.acknowledged_version', 1);

    asActor($this, $this->operatorHeaders)
        ->patchJson(
            "/api/v1/warehouse/supply-requests/{$request['id']}/items/{$request['items'][0]['id']}",
            ['expected_version' => 1, 'prepared_quantity' => '5'],
        )
        ->assertOk()
        ->assertJsonPath('data.items.0.prepared_quantity', '5.000000');

    asActor($this, $this->operatorHeaders)
        ->postJson("/api/v1/warehouse/supply-requests/{$request['id']}/ready", ['expected_version' => 1])
        ->assertOk()
        ->assertJsonPath('data.status', 'ready');

    $this->assertDatabaseCount('inventory_transfers', 0);

    asActor($this, $this->cashierHeaders)
        ->postJson(
            supplyRequestUrl($this->session, $this->order)."/{$request['id']}/receive",
            ['expected_version' => 1],
        )
        ->assertOk()
        ->assertJsonPath('data.status', 'delivered');

    $this->assertDatabaseHas('stocks', [
        'warehouse_id' => $this->main->id,
        'product_id' => $this->product->id,
        'quantity' => '95.000000',
    ]);
    $this->assertDatabaseHas('stocks', [
        'warehouse_id' => $this->pos->id,
        'product_id' => $this->product->id,
        'quantity' => '5.000000',
    ]);

    asActor($this, $this->cashierHeaders)
        ->postJson(
            "/api/v1/cash-register-sessions/{$this->session->id}/orders/{$this->order->id}/checkout",
            [
                'expected_total' => '50.00',
                'payment' => ['method' => 'cash', 'received_amount' => '50.00', 'reference' => null],
            ],
        )
        ->assertCreated()
        ->assertJsonPath('data.order.status', 'completed');
});

it('versions POS changes, preserves prepared quantities and rejects stale warehouse actions', function (): void {
    $request = createSupplyRequest($this);

    asActor($this, $this->operatorHeaders)
        ->postJson("/api/v1/warehouse/supply-requests/{$request['id']}/acknowledge", ['expected_version' => 1])
        ->assertOk();
    asActor($this, $this->operatorHeaders)
        ->patchJson(
            "/api/v1/warehouse/supply-requests/{$request['id']}/items/{$request['items'][0]['id']}",
            ['expected_version' => 1, 'prepared_quantity' => '5'],
        )
        ->assertOk();

    $orderItemId = $this->order->items()->firstOrFail()->id;
    asActor($this, $this->cashierHeaders)
        ->patchJson(
            "/api/v1/cash-register-sessions/{$this->session->id}/orders/{$this->order->id}/items/{$orderItemId}",
            ['quantity' => 7],
        )
        ->assertOk()
        ->assertJsonPath('data.supply_requests.0.status', 'changes_pending')
        ->assertJsonPath('data.supply_requests.0.version', 2)
        ->assertJsonPath('data.supply_requests.0.has_unreviewed_changes', true)
        ->assertJsonPath('data.supply_requests.0.items.0.change_type', 'increased')
        ->assertJsonPath('data.supply_requests.0.items.0.requested_quantity', '7.000000')
        ->assertJsonPath('data.supply_requests.0.items.0.prepared_quantity', '5.000000');

    asActor($this, $this->operatorHeaders)
        ->patchJson(
            "/api/v1/warehouse/supply-requests/{$request['id']}/items/{$request['items'][0]['id']}",
            ['expected_version' => 1, 'prepared_quantity' => '7'],
        )
        ->assertConflict();

    asActor($this, $this->operatorHeaders)
        ->postJson("/api/v1/warehouse/supply-requests/{$request['id']}/acknowledge", ['expected_version' => 2])
        ->assertOk()
        ->assertJsonPath('data.status', 'preparing')
        ->assertJsonPath('data.acknowledged_version', 2);
});

it('sends general and product instructions and versions their later changes', function (): void {
    $orderItemId = $this->order->items()->firstOrFail()->id;

    asActor($this, $this->cashierHeaders)
        ->patchJson(
            "/api/v1/cash-register-sessions/{$this->session->id}/orders/{$this->order->id}/warehouse-notes",
            ['warehouse_notes' => '  Entregar primero este pedido.  '],
        )
        ->assertOk()
        ->assertJsonPath('data.warehouse_notes', 'Entregar primero este pedido.');

    asActor($this, $this->cashierHeaders)
        ->patchJson(
            "/api/v1/cash-register-sessions/{$this->session->id}/orders/{$this->order->id}/items/{$orderItemId}",
            ['quantity' => 5, 'warehouse_notes' => 'Separar en cinco bolsas.'],
        )
        ->assertOk()
        ->assertJsonPath('data.items.0.warehouse_notes', 'Separar en cinco bolsas.');

    $request = createSupplyRequest($this);
    expect($request['warehouse_notes'])->toBe('Entregar primero este pedido.')
        ->and($request['items'][0]['warehouse_notes'])->toBe('Separar en cinco bolsas.');

    asActor($this, $this->operatorHeaders)
        ->getJson('/api/v1/warehouse/supply-requests')
        ->assertOk()
        ->assertJsonPath('data.0.warehouse_notes', 'Entregar primero este pedido.')
        ->assertJsonPath('data.0.items.0.warehouse_notes', 'Separar en cinco bolsas.');

    asActor($this, $this->operatorHeaders)
        ->postJson("/api/v1/warehouse/supply-requests/{$request['id']}/acknowledge", ['expected_version' => 1])
        ->assertOk();
    asActor($this, $this->operatorHeaders)
        ->patchJson(
            "/api/v1/warehouse/supply-requests/{$request['id']}/items/{$request['items'][0]['id']}",
            ['expected_version' => 1, 'prepared_quantity' => 2],
        )
        ->assertOk();

    asActor($this, $this->cashierHeaders)
        ->patchJson(
            "/api/v1/cash-register-sessions/{$this->session->id}/orders/{$this->order->id}/warehouse-notes",
            ['warehouse_notes' => 'Entrega urgente y completa.'],
        )
        ->assertOk()
        ->assertJsonPath('data.supply_requests.0.status', 'changes_pending')
        ->assertJsonPath('data.supply_requests.0.version', 2)
        ->assertJsonPath('data.supply_requests.0.warehouse_notes', 'Entrega urgente y completa.')
        ->assertJsonPath('data.supply_requests.0.warehouse_notes_changed_version', 2);

    asActor($this, $this->cashierHeaders)
        ->patchJson(
            "/api/v1/cash-register-sessions/{$this->session->id}/orders/{$this->order->id}/items/{$orderItemId}",
            ['quantity' => 5, 'warehouse_notes' => 'Usar bolsas transparentes.'],
        )
        ->assertOk()
        ->assertJsonPath('data.supply_requests.0.version', 3)
        ->assertJsonPath('data.supply_requests.0.items.0.change_type', 'note_changed')
        ->assertJsonPath('data.supply_requests.0.items.0.warehouse_notes', 'Usar bolsas transparentes.')
        ->assertJsonPath('data.supply_requests.0.items.0.prepared_quantity', '2.000000');

    asActor($this, $this->operatorHeaders)
        ->postJson("/api/v1/warehouse/supply-requests/{$request['id']}/acknowledge", ['expected_version' => 2])
        ->assertConflict();
    asActor($this, $this->operatorHeaders)
        ->postJson("/api/v1/warehouse/supply-requests/{$request['id']}/acknowledge", ['expected_version' => 3])
        ->assertOk()
        ->assertJsonPath('data.acknowledged_version', 3);
});

it('forces warehouse to correct already prepared items that POS decreases or removes', function (): void {
    $request = createSupplyRequest($this);
    $itemId = $request['items'][0]['id'];

    asActor($this, $this->operatorHeaders)
        ->postJson("/api/v1/warehouse/supply-requests/{$request['id']}/acknowledge", ['expected_version' => 1])
        ->assertOk();
    asActor($this, $this->operatorHeaders)
        ->patchJson(
            "/api/v1/warehouse/supply-requests/{$request['id']}/items/{$itemId}",
            ['expected_version' => 1, 'prepared_quantity' => '5'],
        )
        ->assertOk();

    $orderItemId = $this->order->items()->firstOrFail()->id;
    asActor($this, $this->cashierHeaders)
        ->deleteJson("/api/v1/cash-register-sessions/{$this->session->id}/orders/{$this->order->id}/items/{$orderItemId}")
        ->assertOk()
        ->assertJsonPath('data.supply_requests.0.status', 'changes_pending')
        ->assertJsonPath('data.supply_requests.0.items.0.change_type', 'removed')
        ->assertJsonPath('data.supply_requests.0.items.0.requested_quantity', '0.000000')
        ->assertJsonPath('data.supply_requests.0.items.0.prepared_quantity', '5.000000');

    asActor($this, $this->operatorHeaders)
        ->postJson("/api/v1/warehouse/supply-requests/{$request['id']}/acknowledge", ['expected_version' => 2])
        ->assertOk();
    asActor($this, $this->operatorHeaders)
        ->postJson("/api/v1/warehouse/supply-requests/{$request['id']}/ready", ['expected_version' => 2])
        ->assertUnprocessable();
    asActor($this, $this->operatorHeaders)
        ->patchJson(
            "/api/v1/warehouse/supply-requests/{$request['id']}/items/{$itemId}",
            ['expected_version' => 2, 'prepared_quantity' => '0'],
        )
        ->assertOk();
});

it('isolates each assigned warehouse queue and action', function (): void {
    $otherOperator = User::factory()->create();
    $otherOperator->assignRole('warehouse');
    grantApiPermissions(
        $otherOperator,
        'pos-supply-requests.view-assigned',
        'pos-supply-requests.prepare-assigned',
    );
    $otherHeaders = ['Authorization' => 'Bearer '.$otherOperator->createToken('other')->plainTextToken];
    $request = createSupplyRequest($this);

    asActor($this, $this->operatorHeaders)
        ->getJson('/api/v1/warehouse/supply-requests')
        ->assertOk()
        ->assertJsonPath('data.0.id', $request['id']);

    asActor($this, $otherHeaders)
        ->getJson('/api/v1/warehouse/supply-requests')
        ->assertOk()
        ->assertJsonCount(0, 'data');

    asActor($this, $otherHeaders)
        ->postJson("/api/v1/warehouse/supply-requests/{$request['id']}/acknowledge", ['expected_version' => 1])
        ->assertUnprocessable();
});

it('keeps the POS order editable and other sales operational while warehouse prepares', function (): void {
    createSupplyRequest($this);
    $orderItemId = $this->order->items()->firstOrFail()->id;

    asActor($this, $this->cashierHeaders)
        ->patchJson(
            "/api/v1/cash-register-sessions/{$this->session->id}/orders/{$this->order->id}/items/{$orderItemId}",
            ['quantity' => 6],
        )
        ->assertOk()
        ->assertJsonPath('data.total', '60.0000');

    $otherOrder = asActor($this, $this->cashierHeaders)
        ->postJson("/api/v1/cash-register-sessions/{$this->session->id}/orders")
        ->assertCreated()
        ->json('data');

    asActor($this, $this->cashierHeaders)
        ->postJson(
            "/api/v1/cash-register-sessions/{$this->session->id}/orders/{$otherOrder['id']}/items",
            ['product_id' => $this->product->id, 'quantity' => 1],
        )
        ->assertCreated();

    asActor($this, $this->cashierHeaders)
        ->postJson(
            "/api/v1/cash-register-sessions/{$this->session->id}/orders/{$otherOrder['id']}/checkout",
            [
                'expected_total' => '10.00',
                'payment' => ['method' => 'cash', 'received_amount' => '10.00', 'reference' => null],
            ],
        )
        ->assertCreated();
});

it('accepts only warehouse assignees and cancels their task with the POS order', function (): void {
    $ordinaryUser = User::factory()->create();

    asActor($this, $this->cashierHeaders)
        ->postJson(supplyRequestUrl($this->session, $this->order), ['assigned_to' => $ordinaryUser->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('assigned_to');

    $request = createSupplyRequest($this);
    asActor($this, $this->cashierHeaders)
        ->patchJson("/api/v1/cash-register-sessions/{$this->session->id}/orders/{$this->order->id}/cancel")
        ->assertOk();

    expect(PosSupplyRequest::query()->findOrFail($request['id'])->status)->toBe('cancelled');
    asActor($this, $this->operatorHeaders)
        ->getJson('/api/v1/warehouse/supply-requests')
        ->assertOk()
        ->assertJsonCount(0, 'data');
});
