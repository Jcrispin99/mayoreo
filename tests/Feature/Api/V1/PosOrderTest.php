<?php

declare(strict_types=1);

use App\Models\CashRegister;
use App\Models\CashRegisterSession;
use App\Models\Customer;
use App\Models\DocumentSeries;
use App\Models\PriceTier;
use App\Models\Product;
use App\Models\Stock;
use App\Models\Store;
use App\Models\UnitOfMeasure;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->user = User::factory()->create();
    grantApiPermissions($this->user, 'cash-sessions.view', 'cash-sessions.manage');
    $this->headers = ['Authorization' => 'Bearer '.$this->user->createToken('pos-order-test')->plainTextToken];
    $this->store = Store::factory()->create();
    $this->warehouse = Warehouse::factory()->for($this->store)->pos()->create();
    $this->otherWarehouse = Warehouse::factory()->for($this->store)->create();
    $this->series = DocumentSeries::factory()->create([
        'document_type' => 'sales_ticket',
        'series_code' => 'PO99',
    ]);
    $this->cashRegister = CashRegister::query()->create([
        'store_id' => $this->store->id,
        'warehouse_id' => $this->warehouse->id,
        'default_sales_series_id' => $this->series->id,
        'code' => 'POS-ORDER',
        'name' => 'Caja órdenes',
        'is_active' => true,
    ]);
    $this->session = CashRegisterSession::query()->create([
        'cash_register_id' => $this->cashRegister->id,
        'opened_by' => $this->user->id,
        'status' => 'open',
        'opening_amount' => '100.00',
        'opened_at' => now(),
    ]);
    $this->product = Product::factory()->create([
        'name' => 'Producto para orden',
        'sku' => 'ORDER-001',
    ]);
    Stock::factory()->for($this->product)->for($this->warehouse)->create(['quantity' => '5.000000']);
    PriceTier::factory()->for($this->product)->create([
        'min_quantity' => 0,
        'max_quantity' => '1.999999',
        'unit_price' => '10.0000',
        'is_active' => true,
    ]);
    PriceTier::factory()->for($this->product)->create([
        'min_quantity' => 2,
        'max_quantity' => null,
        'unit_price' => '8.0000',
        'is_active' => true,
    ]);
});

it('creates and lists consecutive open orders for the cash session', function (): void {
    $first = $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-register-sessions/{$this->session->id}/orders")
        ->assertCreated()
        ->assertJsonPath('data.number', 1)
        ->assertJsonPath('data.status', 'open')
        ->assertJsonPath('data.total', '0.0000');

    $second = $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-register-sessions/{$this->session->id}/orders")
        ->assertCreated()
        ->assertJsonPath('data.number', 2);

    $this->withHeaders($this->headers)
        ->getJson("/api/v1/cash-register-sessions/{$this->session->id}/orders")
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.id', $first->json('data.id'))
        ->assertJsonPath('data.1.id', $second->json('data.id'));
});

it('assigns, replaces and removes an active customer from an open order', function (): void {
    $orderId = $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-register-sessions/{$this->session->id}/orders")
        ->json('data.id');
    $customer = Customer::factory()->create([
        'name' => 'Cliente del POS',
        'document_number' => '44556677',
    ]);
    $inactiveCustomer = Customer::factory()->create(['is_active' => false]);
    $url = "/api/v1/cash-register-sessions/{$this->session->id}/orders/{$orderId}/customer";

    $this->withHeaders($this->headers)
        ->patchJson($url, ['customer_id' => $customer->id])
        ->assertOk()
        ->assertJsonPath('data.customer_id', $customer->id)
        ->assertJsonPath('data.customer.id', $customer->id)
        ->assertJsonPath('data.customer.name', 'Cliente del POS');

    $this->withHeaders($this->headers)
        ->patchJson($url, ['customer_id' => $inactiveCustomer->id])
        ->assertUnprocessable();

    $this->assertDatabaseHas('pos_orders', [
        'id' => $orderId,
        'customer_id' => $customer->id,
    ]);

    $this->withHeaders($this->headers)
        ->patchJson($url, ['customer_id' => null])
        ->assertOk()
        ->assertJsonPath('data.customer_id', null)
        ->assertJsonPath('data.customer', null);
});

it('adds products and recalculates quantity tier without changing stock', function (): void {
    $orderId = $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-register-sessions/{$this->session->id}/orders")
        ->json('data.id');
    $itemsUrl = "/api/v1/cash-register-sessions/{$this->session->id}/orders/{$orderId}/items";

    $this->withHeaders($this->headers)
        ->postJson($itemsUrl, ['product_id' => $this->product->id, 'quantity' => 1])
        ->assertCreated()
        ->assertJsonPath('data.items.0.quantity', '1.000000')
        ->assertJsonPath('data.items.0.unit_price', '10.0000')
        ->assertJsonPath('data.total', '10.0000');

    $this->withHeaders($this->headers)
        ->postJson($itemsUrl, ['product_id' => $this->product->id, 'quantity' => 1])
        ->assertCreated()
        ->assertJsonCount(1, 'data.items')
        ->assertJsonPath('data.items.0.quantity', '2.000000')
        ->assertJsonPath('data.items.0.unit_price', '8.0000')
        ->assertJsonPath('data.items.0.line_total', '16.0000')
        ->assertJsonPath('data.total', '16.0000');

    $this->assertDatabaseHas('stocks', [
        'warehouse_id' => $this->warehouse->id,
        'product_id' => $this->product->id,
        'quantity' => '5.000000',
    ]);
    $this->assertDatabaseCount('inventory_movements', 0);
});

it('sells packaged variants as whole units and exposes their total content', function (): void {
    $units = UnitOfMeasure::factory()->create([
        'code' => 'NIU',
        'name' => 'Unidad',
        'type' => 'count',
    ]);
    $grams = UnitOfMeasure::query()->where('code', 'g')->firstOrFail();
    $packaged = Product::factory()->create([
        'name' => 'Arroz Extra - Bolsa 100 g',
        'variant_name' => 'Bolsa 100 g',
        'sku' => 'ARROZ-100G',
        'base_unit_id' => $units->id,
        'sale_mode' => 'unit',
        'content_quantity' => 100,
        'content_unit_id' => $grams->id,
    ]);
    Stock::factory()->for($packaged)->for($this->warehouse)->create(['quantity' => '20.000000']);
    PriceTier::factory()->for($packaged)->create([
        'min_quantity' => 1,
        'max_quantity' => null,
        'unit_price' => '2.0000',
        'is_active' => true,
    ]);
    $orderId = $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-register-sessions/{$this->session->id}/orders")
        ->json('data.id');
    $itemsUrl = "/api/v1/cash-register-sessions/{$this->session->id}/orders/{$orderId}/items";

    $this->withHeaders($this->headers)
        ->postJson($itemsUrl, ['product_id' => $packaged->id, 'quantity' => 3])
        ->assertCreated()
        ->assertJsonPath('data.items.0.quantity', '3.000000')
        ->assertJsonPath('data.items.0.line_total', '6.0000')
        ->assertJsonPath('data.items.0.product.content_quantity', '100.000000')
        ->assertJsonPath('data.items.0.product.content_unit.code', 'g');

    $this->withHeaders($this->headers)
        ->postJson($itemsUrl, ['product_id' => $packaged->id, 'quantity' => '0.5'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('quantity');
});

it('keeps free weight entry on the measured variant', function (): void {
    $orderId = $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-register-sessions/{$this->session->id}/orders")
        ->json('data.id');

    $this->withHeaders($this->headers)
        ->postJson(
            "/api/v1/cash-register-sessions/{$this->session->id}/orders/{$orderId}/items",
            ['product_id' => $this->product->id, 'quantity' => 300, 'unit_code' => 'g'],
        )
        ->assertCreated()
        ->assertJsonPath('data.items.0.quantity', '300.000000')
        ->assertJsonPath('data.items.0.product.sale_mode', 'measured');
});

it('converts kilograms to the weight base unit before resolving the price tier', function (): void {
    PriceTier::factory()->for($this->product)->create([
        'min_quantity' => 0,
        'max_quantity' => null,
        'unit_price' => '1.0000',
        'label' => 'Inactivo',
        'is_active' => false,
    ]);
    $orderId = $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-register-sessions/{$this->session->id}/orders")
        ->json('data.id');
    $itemsUrl = "/api/v1/cash-register-sessions/{$this->session->id}/orders/{$orderId}/items";

    $this->withHeaders($this->headers)
        ->postJson($itemsUrl, [
            'product_id' => $this->product->id,
            'quantity' => '1',
            'unit_code' => ' KG ',
        ])
        ->assertCreated()
        ->assertJsonPath('data.items.0.quantity', '1000.000000')
        ->assertJsonPath('data.items.0.input_quantity', '1000.000000')
        ->assertJsonPath('data.items.0.input_unit_id', $this->product->base_unit_id)
        ->assertJsonPath('data.items.0.unit_price', '8.0000')
        ->assertJsonPath('data.items.0.line_total', '8000.0000')
        ->assertJsonPath('data.total', '8000.0000')
        ->assertJsonCount(2, 'data.items.0.product.price_tiers')
        ->assertJsonPath('data.items.0.product.price_tiers.0.min_quantity', '0.000000')
        ->assertJsonPath('data.items.0.product.price_tiers.1.min_quantity', '2.000000');

    $this->withHeaders($this->headers)
        ->getJson("/api/v1/cash-register-sessions/{$this->session->id}/orders")
        ->assertOk()
        ->assertJsonCount(2, 'data.0.items.0.product.price_tiers')
        ->assertJsonMissing(['label' => 'Inactivo']);
});

it('converts liters to milliliters before resolving the price tier', function (): void {
    $milliliters = UnitOfMeasure::factory()->milliliters()->create();
    $product = Product::factory()->create([
        'base_unit_id' => $milliliters->id,
        'name' => 'Aceite a granel',
        'sku' => 'ORDER-VOLUME',
    ]);
    Stock::factory()->for($product)->for($this->warehouse)->create(['quantity' => '5000.000000']);
    PriceTier::factory()->for($product)->create([
        'min_quantity' => 0,
        'max_quantity' => '999.999999',
        'unit_price' => '0.0100',
        'is_active' => true,
    ]);
    PriceTier::factory()->for($product)->create([
        'min_quantity' => 1000,
        'max_quantity' => null,
        'unit_price' => '0.0080',
        'is_active' => true,
    ]);
    $orderId = $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-register-sessions/{$this->session->id}/orders")
        ->json('data.id');

    $this->withHeaders($this->headers)
        ->postJson(
            "/api/v1/cash-register-sessions/{$this->session->id}/orders/{$orderId}/items",
            ['product_id' => $product->id, 'quantity' => '1.5', 'unit_code' => 'L'],
        )
        ->assertCreated()
        ->assertJsonPath('data.items.0.quantity', '1500.000000')
        ->assertJsonPath('data.items.0.input_quantity', '1500.000000')
        ->assertJsonPath('data.items.0.input_unit_id', $milliliters->id)
        ->assertJsonPath('data.items.0.unit_price', '0.0080')
        ->assertJsonPath('data.items.0.line_total', '12.0000')
        ->assertJsonPath('data.total', '12.0000');
});

it('updates and removes an order line', function (): void {
    $order = $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-register-sessions/{$this->session->id}/orders")
        ->json('data');
    $order = $this->withHeaders($this->headers)
        ->postJson(
            "/api/v1/cash-register-sessions/{$this->session->id}/orders/{$order['id']}/items",
            ['product_id' => $this->product->id, 'quantity' => 1],
        )
        ->json('data');
    $lineId = $order['items'][0]['id'];
    $lineUrl = "/api/v1/cash-register-sessions/{$this->session->id}/orders/{$order['id']}/items/{$lineId}";

    $this->withHeaders($this->headers)
        ->patchJson($lineUrl, ['quantity' => '3.5'])
        ->assertOk()
        ->assertJsonPath('data.items.0.quantity', '3.500000')
        ->assertJsonPath('data.total', '28.0000');

    $this->withHeaders($this->headers)
        ->deleteJson($lineUrl)
        ->assertOk()
        ->assertJsonCount(0, 'data.items')
        ->assertJsonPath('data.total', '0.0000');
});

it('converts the entry unit when updating an order line', function (): void {
    $order = $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-register-sessions/{$this->session->id}/orders")
        ->json('data');
    $order = $this->withHeaders($this->headers)
        ->postJson(
            "/api/v1/cash-register-sessions/{$this->session->id}/orders/{$order['id']}/items",
            ['product_id' => $this->product->id, 'quantity' => 1],
        )
        ->json('data');
    $lineUrl = "/api/v1/cash-register-sessions/{$this->session->id}/orders/{$order['id']}/items/{$order['items'][0]['id']}";

    $this->withHeaders($this->headers)
        ->patchJson($lineUrl, ['quantity' => '0.5', 'unit_code' => 'kg'])
        ->assertOk()
        ->assertJsonPath('data.items.0.quantity', '500.000000')
        ->assertJsonPath('data.items.0.input_quantity', '500.000000')
        ->assertJsonPath('data.items.0.input_unit_id', $this->product->base_unit_id)
        ->assertJsonPath('data.items.0.unit_price', '8.0000')
        ->assertJsonPath('data.items.0.line_total', '4000.0000');
});

it('rejects entry units that are incompatible with the product base unit type', function (): void {
    $orderId = $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-register-sessions/{$this->session->id}/orders")
        ->json('data.id');
    $itemsUrl = "/api/v1/cash-register-sessions/{$this->session->id}/orders/{$orderId}/items";

    $this->withHeaders($this->headers)
        ->postJson($itemsUrl, [
            'product_id' => $this->product->id,
            'quantity' => 1,
            'unit_code' => 'ml',
        ])
        ->assertUnprocessable()
        ->assertJsonPath(
            'message',
            "Unit code [ml] does not match the base unit of product [{$this->product->id}].",
        );

    $this->assertDatabaseCount('productables', 0);
});

it('rejects products that are inactive or belong only to another store', function (): void {
    $inactive = Product::factory()->create(['is_active' => false]);
    Stock::factory()->for($inactive)->for($this->warehouse)->create();
    PriceTier::factory()->for($inactive)->create();

    $otherStore = Store::factory()->create();
    $otherWarehouse = Warehouse::factory()->for($otherStore)->create();
    $otherProduct = Product::factory()->create();
    Stock::factory()->for($otherProduct)->for($otherWarehouse)->create();
    PriceTier::factory()->for($otherProduct)->create();

    $orderId = $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-register-sessions/{$this->session->id}/orders")
        ->json('data.id');
    $url = "/api/v1/cash-register-sessions/{$this->session->id}/orders/{$orderId}/items";

    $this->withHeaders($this->headers)
        ->postJson($url, ['product_id' => $inactive->id, 'quantity' => 1])
        ->assertUnprocessable();
    $this->withHeaders($this->headers)
        ->postJson($url, ['product_id' => $otherProduct->id, 'quantity' => 1])
        ->assertUnprocessable();
});

it('rejects cross-session orders and operations on a closed session', function (): void {
    $orderId = $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-register-sessions/{$this->session->id}/orders")
        ->json('data.id');
    $otherRegister = CashRegister::query()->create([
        'store_id' => $this->store->id,
        'warehouse_id' => $this->warehouse->id,
        'default_sales_series_id' => $this->series->id,
        'code' => 'POS-OTHER',
        'name' => 'Otra caja',
        'is_active' => true,
    ]);
    $otherSession = CashRegisterSession::query()->create([
        'cash_register_id' => $otherRegister->id,
        'opened_by' => $this->user->id,
        'status' => 'open',
        'opening_amount' => '0',
        'opened_at' => now(),
    ]);

    $this->withHeaders($this->headers)
        ->postJson(
            "/api/v1/cash-register-sessions/{$otherSession->id}/orders/{$orderId}/items",
            ['product_id' => $this->product->id, 'quantity' => 1],
        )
        ->assertUnprocessable();

    $otherSession->update([
        'status' => 'closed',
        'expected_amount' => '0',
        'counted_amount' => '0',
        'difference_amount' => '0',
        'closed_at' => now(),
    ]);

    $this->withHeaders($this->headers)
        ->getJson("/api/v1/cash-register-sessions/{$otherSession->id}/orders")
        ->assertUnprocessable();
    $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-register-sessions/{$otherSession->id}/orders")
        ->assertUnprocessable();
});

it('requires open orders to be cancelled before closing the cash session', function (): void {
    $orderId = $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-register-sessions/{$this->session->id}/orders")
        ->json('data.id');

    $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-register-sessions/{$this->session->id}/close", ['counted_amount' => 100])
        ->assertUnprocessable();

    $this->withHeaders($this->headers)
        ->patchJson("/api/v1/cash-register-sessions/{$this->session->id}/orders/{$orderId}/cancel")
        ->assertOk()
        ->assertJsonPath('data.status', 'cancelled');

    $this->withHeaders($this->headers)
        ->postJson("/api/v1/cash-register-sessions/{$this->session->id}/close", ['counted_amount' => 100])
        ->assertOk()
        ->assertJsonPath('data.status', 'closed');
});

it('requires authentication for POS orders', function (): void {
    $this->getJson("/api/v1/cash-register-sessions/{$this->session->id}/orders")
        ->assertUnauthorized();
    $this->postJson("/api/v1/cash-register-sessions/{$this->session->id}/orders")
        ->assertUnauthorized();
});
