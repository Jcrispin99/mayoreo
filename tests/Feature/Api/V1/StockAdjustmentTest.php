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
    grantApiPermissions($user, 'stock.view', 'stock.manage');
    $this->headers = ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    $this->product = Product::factory()->create();
    $this->warehouse = Warehouse::factory()->main()->create();
});

describe('List stocks', function (): void {
    it('lists current stock balances', function (): void {
        app(StockLedgerService::class)->registerIn($this->product, $this->warehouse, '100', '5.0000');

        $response = $this->withHeaders($this->headers)->getJson('/api/v1/stocks');

        $response->assertOk()->assertJsonCount(1, 'data')->assertJson([
            'data' => [
                ['quantity' => '100.000000', 'average_cost' => '5.0000'],
            ],
        ]);
    });

    it('filters by warehouse and product', function (): void {
        $other = Warehouse::factory()->retail()->create();
        app(StockLedgerService::class)->registerIn($this->product, $this->warehouse, '100', '5.0000');
        app(StockLedgerService::class)->registerIn($this->product, $other, '30', '5.0000');

        $response = $this->withHeaders($this->headers)->getJson("/api/v1/stocks?warehouse_id={$this->warehouse->id}");

        $response->assertOk()->assertJsonCount(1, 'data');
    });
});

describe('List inventory movements', function (): void {
    it('lists the kardex with product, warehouse and flow information', function (): void {
        app(StockLedgerService::class)->registerIn($this->product, $this->warehouse, '100', '5.0000', notes: 'Entrada inicial');
        app(StockLedgerService::class)->registerOut($this->product, $this->warehouse, '20', 'sale');

        $response = $this->withHeaders($this->headers)->getJson('/api/v1/inventory-movements');

        $response->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.flow', 'out')
            ->assertJsonPath('data.0.product.name', $this->product->name)
            ->assertJsonPath('data.0.warehouse.name', $this->warehouse->name)
            ->assertJsonPath('data.1.flow', 'in');
    });

    it('filters kardex movements by product and flow', function (): void {
        $otherProduct = Product::factory()->create();
        app(StockLedgerService::class)->registerIn($this->product, $this->warehouse, '100', '5.0000');
        app(StockLedgerService::class)->registerOut($this->product, $this->warehouse, '20', 'sale');
        app(StockLedgerService::class)->registerIn($otherProduct, $this->warehouse, '50', '2.0000');

        $response = $this->withHeaders($this->headers)
            ->getJson("/api/v1/inventory-movements?product_id={$this->product->id}&flow=in");

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.product_id', $this->product->id)
            ->assertJsonPath('data.0.flow', 'in');
    });
});

describe('Adjust stock', function (): void {
    it('increases stock with a manual adjustment', function (): void {
        $response = $this->withHeaders($this->headers)->postJson('/api/v1/stocks/adjust', [
            'product_id' => $this->product->id,
            'warehouse_id' => $this->warehouse->id,
            'direction' => 'increase',
            'quantity' => 50,
            'unit_cost' => 4,
            'notes' => 'Conteo físico inicial',
        ]);

        $response->assertCreated()->assertJson([
            'data' => ['type' => 'adjustment', 'direction' => 'increase', 'balance_quantity' => '50.000000'],
        ]);

        $this->assertDatabaseHas('stocks', [
            'product_id' => $this->product->id,
            'warehouse_id' => $this->warehouse->id,
            'quantity' => '50.000000',
        ]);
    });

    it('decreases stock with a manual adjustment', function (): void {
        app(StockLedgerService::class)->registerIn($this->product, $this->warehouse, '100', '5.0000');

        $response = $this->withHeaders($this->headers)->postJson('/api/v1/stocks/adjust', [
            'product_id' => $this->product->id,
            'warehouse_id' => $this->warehouse->id,
            'direction' => 'decrease',
            'quantity' => 20,
            'notes' => 'Merma',
        ]);

        $response->assertCreated()->assertJson([
            'data' => ['direction' => 'decrease', 'balance_quantity' => '80.000000'],
        ]);
    });

    it('fails when decreasing more than available', function (): void {
        app(StockLedgerService::class)->registerIn($this->product, $this->warehouse, '10', '5.0000');

        $response = $this->withHeaders($this->headers)->postJson('/api/v1/stocks/adjust', [
            'product_id' => $this->product->id,
            'warehouse_id' => $this->warehouse->id,
            'direction' => 'decrease',
            'quantity' => 50,
        ]);

        $response->assertUnprocessable();
    });

    it('fails with an invalid direction', function (): void {
        $response = $this->withHeaders($this->headers)->postJson('/api/v1/stocks/adjust', [
            'product_id' => $this->product->id,
            'warehouse_id' => $this->warehouse->id,
            'direction' => 'sideways',
            'quantity' => 10,
        ]);

        $response->assertUnprocessable()->assertJsonValidationErrors('direction');
    });
});
