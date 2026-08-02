<?php

declare(strict_types=1);

use App\Models\CashRegister;
use App\Models\CashRegisterSession;
use App\Models\DocumentSeries;
use App\Models\PosOrder;
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
        'pos-supply-requests.resolve-assigned',
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
    // El almacén de la caja arranca sin stock del producto.
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

/**
 * Sanctum's guard caches the resolved user for the lifetime of the test's
 * container, so switching Bearer tokens mid-test needs a fresh guard or it
 * keeps authenticating as whoever went first.
 *
 * @param  array<string, string>  $headers
 */
function asActor(Tests\TestCase $test, array $headers): Tests\TestCase
{
    app('auth')->forgetGuards();

    return $test->withHeaders($headers);
}

it('lets the seller ask the almacén de medio for the missing stock, and the checkout unblocks once resolved', function (): void {
    // El cajero pide la comanda: la caja no tiene los 5 que la orden necesita.
    $transfer = asActor($this, $this->cashierHeaders)
        ->postJson(supplyRequestUrl($this->session, $this->order), ['assigned_to' => $this->warehouseOperator->id])
        ->assertCreated()
        ->assertJsonPath('data.status', 'draft')
        ->assertJsonPath('data.from_warehouse_id', $this->main->id)
        ->assertJsonPath('data.to_warehouse_id', $this->pos->id)
        ->assertJsonPath('data.pos_order_id', $this->order->id)
        ->assertJsonPath('data.assigned_to', $this->warehouseOperator->id)
        ->assertJsonPath('data.items.0.product_id', $this->product->id)
        ->assertJsonPath('data.items.0.quantity', '5.000000')
        ->json('data');

    // El cajero (sin permiso de almacén) no puede resolver la comanda.
    asActor($this, $this->cashierHeaders)
        ->postJson("/api/v1/warehouse/supply-requests/{$transfer['id']}/resolve")
        ->assertForbidden();

    // El almacén de medio ve su cola de comandas pendientes por polling.
    asActor($this, $this->operatorHeaders)
        ->getJson('/api/v1/warehouse/supply-requests?status=draft')
        ->assertOk()
        ->assertJsonPath('data.0.id', $transfer['id']);

    // El almacén marca "listo": se despacha y recibe en un solo paso.
    asActor($this, $this->operatorHeaders)
        ->postJson("/api/v1/warehouse/supply-requests/{$transfer['id']}/resolve")
        ->assertOk()
        ->assertJsonPath('data.status', 'received');

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

    // El cajero, haciendo polling de la orden, ve la comanda resuelta.
    asActor($this, $this->cashierHeaders)
        ->getJson("/api/v1/cash-register-sessions/{$this->session->id}/orders/{$this->order->id}")
        ->assertOk()
        ->assertJsonPath('data.supply_requests.0.status', 'received');

    // Y ya puede cobrar la orden normalmente.
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

it('still requests the full quantity even when the system thinks the register already has enough stock', function (): void {
    // El conteo del sistema no es confiable (ventas o mermas no registradas),
    // así que no se usa para decidir si hay que pedir al almacén.
    Stock::query()
        ->where('warehouse_id', $this->pos->id)
        ->where('product_id', $this->product->id)
        ->update(['quantity' => '10.000000']);

    asActor($this, $this->cashierHeaders)
        ->postJson(supplyRequestUrl($this->session, $this->order), ['assigned_to' => $this->warehouseOperator->id])
        ->assertCreated()
        ->assertJsonPath('data.items.0.quantity', '5.000000');
});

it('shows a comanda only to its assigned warehouse user', function (): void {
    $otherOperator = User::factory()->create();
    $otherOperator->assignRole('warehouse');
    grantApiPermissions(
        $otherOperator,
        'pos-supply-requests.view-assigned',
        'pos-supply-requests.resolve-assigned',
    );
    $otherHeaders = ['Authorization' => 'Bearer '.$otherOperator->createToken('other-operator')->plainTextToken];

    $transferId = asActor($this, $this->cashierHeaders)
        ->postJson(supplyRequestUrl($this->session, $this->order), ['assigned_to' => $this->warehouseOperator->id])
        ->assertCreated()
        ->json('data.id');

    asActor($this, $this->operatorHeaders)
        ->getJson('/api/v1/warehouse/supply-requests?status=draft')
        ->assertOk()
        ->assertJsonPath('data.0.id', $transferId);

    asActor($this, $otherHeaders)
        ->getJson('/api/v1/warehouse/supply-requests?status=draft')
        ->assertOk()
        ->assertJsonCount(0, 'data');

    asActor($this, $otherHeaders)
        ->postJson("/api/v1/warehouse/supply-requests/{$transferId}/resolve")
        ->assertForbidden();
});

it('accepts only assignees with the warehouse role', function (): void {
    $ordinaryUser = User::factory()->create();

    asActor($this, $this->cashierHeaders)
        ->postJson(supplyRequestUrl($this->session, $this->order), ['assigned_to' => $ordinaryUser->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('assigned_to');

    asActor($this, $this->cashierHeaders)
        ->getJson('/api/v1/pos/supply-assignees')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $this->warehouseOperator->id);
});

it('keeps other orders operational while one order waits for the warehouse', function (): void {
    asActor($this, $this->cashierHeaders)
        ->postJson(supplyRequestUrl($this->session, $this->order), ['assigned_to' => $this->warehouseOperator->id])
        ->assertCreated();

    // La orden enviada queda congelada individualmente.
    asActor($this, $this->cashierHeaders)
        ->patchJson(
            "/api/v1/cash-register-sessions/{$this->session->id}/orders/{$this->order->id}/items/{$this->order->items()->first()->id}",
            ['quantity' => 6],
        )
        ->assertUnprocessable();

    // Otra orden se puede crear, editar y cobrar con normalidad.
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
        ->assertCreated()
        ->assertJsonPath('data.order.status', 'completed');
});

it('refuses a second supply request once everything the order needs was already requested', function (): void {
    asActor($this, $this->cashierHeaders)
        ->postJson(supplyRequestUrl($this->session, $this->order), ['assigned_to' => $this->warehouseOperator->id])
        ->assertCreated();

    // Nada cambió en la orden desde la primera comanda: ya se pidió todo.
    asActor($this, $this->cashierHeaders)
        ->postJson(supplyRequestUrl($this->session, $this->order), ['assigned_to' => $this->warehouseOperator->id])
        ->assertUnprocessable();
});

it('lets the seller request more once new items are added on top of an already-requested comanda', function (): void {
    asActor($this, $this->cashierHeaders)
        ->postJson(supplyRequestUrl($this->session, $this->order), ['assigned_to' => $this->warehouseOperator->id])
        ->assertCreated();

    $transferId = $this->order->supplyRequests()->latest('id')->value('id');
    asActor($this, $this->operatorHeaders)
        ->postJson("/api/v1/warehouse/supply-requests/{$transferId}/resolve")
        ->assertOk();

    asActor($this, $this->cashierHeaders)
        ->patchJson(
            "/api/v1/cash-register-sessions/{$this->session->id}/orders/{$this->order->id}/items/{$this->order->items()->first()->id}",
            ['quantity' => 8],
        )
        ->assertOk();

    // Ya se pidieron 5, la orden ahora necesita 8: solo debe pedir los 3 nuevos.
    asActor($this, $this->cashierHeaders)
        ->postJson(supplyRequestUrl($this->session, $this->order), ['assigned_to' => $this->warehouseOperator->id])
        ->assertCreated()
        ->assertJsonPath('data.items.0.quantity', '3.000000');
});

it('resolves a comanda even when the source warehouse itself does not have enough stock, leaving it negative', function (): void {
    // El almacén principal solo tiene 2, pero la orden necesita 5.
    Stock::query()
        ->where('warehouse_id', $this->main->id)
        ->where('product_id', $this->product->id)
        ->update(['quantity' => '2.000000']);

    $transfer = asActor($this, $this->cashierHeaders)
        ->postJson(supplyRequestUrl($this->session, $this->order), ['assigned_to' => $this->warehouseOperator->id])
        ->assertCreated()
        ->json('data');

    // El almacén igual entrega: la operación continúa, el stock queda negativo.
    asActor($this, $this->operatorHeaders)
        ->postJson("/api/v1/warehouse/supply-requests/{$transfer['id']}/resolve")
        ->assertOk()
        ->assertJsonPath('data.status', 'received');

    $this->assertDatabaseHas('stocks', [
        'warehouse_id' => $this->main->id,
        'product_id' => $this->product->id,
        'quantity' => '-3.000000',
    ]);
    $this->assertDatabaseHas('stocks', [
        'warehouse_id' => $this->pos->id,
        'product_id' => $this->product->id,
        'quantity' => '5.000000',
    ]);
});
