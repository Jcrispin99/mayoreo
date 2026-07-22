<?php

declare(strict_types=1);

use App\Models\DocumentSeries;
use App\Models\PriceTier;
use App\Models\Product;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\StockLedgerService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    DocumentSeries::factory()->create(['document_type' => 'sales_ticket', 'series_code' => 'NV01']);

    $user = User::factory()->create();
    $this->headers = ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    $this->pos = Warehouse::factory()->pos()->create();
    $this->product = Product::factory()->create();

    PriceTier::factory()->for($this->product)->create(['min_quantity' => 0, 'max_quantity' => 249.999999, 'unit_price' => 16.2, 'label' => 'Fraccionado']);
    PriceTier::factory()->for($this->product)->create(['min_quantity' => 250, 'max_quantity' => 1999.999999, 'unit_price' => 12, 'label' => 'Menudeo']);
    PriceTier::factory()->for($this->product)->create(['min_quantity' => 2000, 'max_quantity' => null, 'unit_price' => 10, 'label' => 'Mayor']);

    app(StockLedgerService::class)->registerIn($this->product, $this->pos, '5000', '5.0000', 'purchase');
});

it('registers a sale, discounts stock, and applies the correct price tier', function (): void {
    $response = $this->withHeaders($this->headers)->postJson('/api/v1/sales', [
        'warehouse_id' => $this->pos->id,
        'items' => [
            ['product_id' => $this->product->id, 'quantity' => 150],
        ],
    ]);

    $response->assertCreated()->assertJson([
        'data' => [
            'total' => '2430.0000', // 150 * 16.2 (fraccionado tier)
        ],
    ]);

    $this->assertDatabaseHas('stocks', [
        'product_id' => $this->product->id,
        'warehouse_id' => $this->pos->id,
        'quantity' => '4850.000000',
    ]);

    $sale = $response->json('data');
    expect($sale['fiscal_documents'])->toHaveCount(1)
        ->and($sale['fiscal_documents'][0]['document_type'])->toBe('sales_ticket')
        ->and($sale['fiscal_documents'][0]['status'])->toBe('issued')
        ->and($sale['fiscal_documents'][0]['number'])->toBe(1);
});

it('applies the mayorista tier for large quantities', function (): void {
    $response = $this->withHeaders($this->headers)->postJson('/api/v1/sales', [
        'warehouse_id' => $this->pos->id,
        'items' => [
            ['product_id' => $this->product->id, 'quantity' => 2500],
        ],
    ]);

    $response->assertCreated()->assertJson([
        'data' => ['total' => '25000.0000'], // 2500 * 10
    ]);
});

it('increments the ticket correlative across multiple sales', function (): void {
    $this->withHeaders($this->headers)->postJson('/api/v1/sales', [
        'warehouse_id' => $this->pos->id,
        'items' => [['product_id' => $this->product->id, 'quantity' => 100]],
    ])->assertCreated();

    $second = $this->withHeaders($this->headers)->postJson('/api/v1/sales', [
        'warehouse_id' => $this->pos->id,
        'items' => [['product_id' => $this->product->id, 'quantity' => 100]],
    ])->assertCreated()->json('data');

    expect($second['fiscal_documents'][0]['number'])->toBe(2);
});

it('rejects a sale when stock is insufficient', function (): void {
    $this->withHeaders($this->headers)->postJson('/api/v1/sales', [
        'warehouse_id' => $this->pos->id,
        'items' => [
            ['product_id' => $this->product->id, 'quantity' => 999999],
        ],
    ])->assertUnprocessable();

    $this->assertDatabaseCount('productables', 0);
});

it('rejects a sale for a quantity with no matching price tier', function (): void {
    $otherProduct = Product::factory()->create();
    app(StockLedgerService::class)->registerIn($otherProduct, $this->pos, '100', '2.0000');

    $this->withHeaders($this->headers)->postJson('/api/v1/sales', [
        'warehouse_id' => $this->pos->id,
        'items' => [
            ['product_id' => $otherProduct->id, 'quantity' => 10],
        ],
    ])->assertUnprocessable();
});
