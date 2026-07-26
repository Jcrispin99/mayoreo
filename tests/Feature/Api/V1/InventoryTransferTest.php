<?php

declare(strict_types=1);

use App\Models\Product;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\StockLedgerService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $user = User::factory()->create();
    grantApiPermissions($user, 'inventory-transfers.view', 'inventory-transfers.manage');
    $this->headers = ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    $this->main = Warehouse::factory()->main()->create();
    $this->retail = Warehouse::factory()->retail()->create();
    $this->pos = Warehouse::factory()->pos()->create();
    $this->product = Product::factory()->create();

    app(StockLedgerService::class)->registerIn($this->product, $this->main, '1000000', '0.0020', 'purchase');
});

it('creates, dispatches and receives a transfer from MAIN to RETAIL', function (): void {
    $transfer = $this->withHeaders($this->headers)->postJson('/api/v1/inventory-transfers', [
        'from_warehouse_id' => $this->main->id,
        'to_warehouse_id' => $this->retail->id,
        'items' => [
            ['product_id' => $this->product->id, 'quantity' => 400000],
        ],
    ])->assertCreated()->assertJson(['data' => ['status' => 'draft']])->json('data');

    $this->withHeaders($this->headers)
        ->postJson("/api/v1/inventory-transfers/{$transfer['id']}/dispatch")
        ->assertOk()->assertJson(['data' => ['status' => 'in_transit']]);

    $this->assertDatabaseHas('stocks', [
        'warehouse_id' => $this->main->id,
        'product_id' => $this->product->id,
        'quantity' => '600000.000000',
    ]);

    $received = $this->withHeaders($this->headers)
        ->postJson("/api/v1/inventory-transfers/{$transfer['id']}/receive")
        ->assertOk()->assertJson(['data' => ['status' => 'received']])->json('data');

    expect($received['status'])->toBe('received');

    $this->assertDatabaseHas('stocks', [
        'warehouse_id' => $this->retail->id,
        'product_id' => $this->product->id,
        'quantity' => '400000.000000',
        'average_cost' => '0.0020',
    ]);
});

it('allows fractional transfers from RETAIL to POS (opening a sack)', function (): void {
    app(StockLedgerService::class)->registerIn($this->product, $this->retail, '50000', '0.0025', 'transfer_in');

    $transfer = $this->withHeaders($this->headers)->postJson('/api/v1/inventory-transfers', [
        'from_warehouse_id' => $this->retail->id,
        'to_warehouse_id' => $this->pos->id,
        'items' => [
            ['product_id' => $this->product->id, 'quantity' => 2500],
        ],
    ])->json('data');

    $this->withHeaders($this->headers)->postJson("/api/v1/inventory-transfers/{$transfer['id']}/dispatch")->assertOk();
    $this->withHeaders($this->headers)->postJson("/api/v1/inventory-transfers/{$transfer['id']}/receive")->assertOk();

    $this->assertDatabaseHas('stocks', [
        'warehouse_id' => $this->pos->id,
        'product_id' => $this->product->id,
        'quantity' => '2500.000000',
    ]);
});

it('allows transfers between active warehouses regardless of their legacy role', function (): void {
    $this->withHeaders($this->headers)->postJson('/api/v1/inventory-transfers', [
        'from_warehouse_id' => $this->pos->id,
        'to_warehouse_id' => $this->main->id,
        'items' => [
            ['product_id' => $this->product->id, 'quantity' => 10],
        ],
    ])->assertCreated();
});

it('rejects a transfer involving an inactive warehouse', function (): void {
    $this->pos->update(['is_active' => false]);

    $this->withHeaders($this->headers)->postJson('/api/v1/inventory-transfers', [
        'from_warehouse_id' => $this->retail->id,
        'to_warehouse_id' => $this->pos->id,
        'items' => [
            ['product_id' => $this->product->id, 'quantity' => 10],
        ],
    ])->assertUnprocessable();
});

it('rejects transferring to the same warehouse', function (): void {
    $this->withHeaders($this->headers)->postJson('/api/v1/inventory-transfers', [
        'from_warehouse_id' => $this->main->id,
        'to_warehouse_id' => $this->main->id,
        'items' => [
            ['product_id' => $this->product->id, 'quantity' => 10],
        ],
    ])->assertUnprocessable();
});

it('rejects dispatching more than the available stock', function (): void {
    $transfer = $this->withHeaders($this->headers)->postJson('/api/v1/inventory-transfers', [
        'from_warehouse_id' => $this->main->id,
        'to_warehouse_id' => $this->retail->id,
        'items' => [
            ['product_id' => $this->product->id, 'quantity' => 9999999],
        ],
    ])->json('data');

    $this->withHeaders($this->headers)
        ->postJson("/api/v1/inventory-transfers/{$transfer['id']}/dispatch")
        ->assertUnprocessable();
});
