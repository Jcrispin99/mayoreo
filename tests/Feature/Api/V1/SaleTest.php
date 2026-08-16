<?php

declare(strict_types=1);

use App\Models\DocumentSeries;
use App\Models\PriceTier;
use App\Models\Product;
use App\Models\ProductTemplate;
use App\Models\UnitOfMeasure;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\StockLedgerService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    DocumentSeries::factory()->create(['document_type' => 'sales_ticket', 'series_code' => 'NV01']);

    $user = User::factory()->create();
    grantApiPermissions($user, 'sales.view', 'sales.manage');
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

it('registers a sale with negative stock when the available balance is insufficient', function (): void {
    $this->withHeaders($this->headers)->postJson('/api/v1/sales', [
        'warehouse_id' => $this->pos->id,
        'items' => [
            ['product_id' => $this->product->id, 'quantity' => 6000],
        ],
    ])->assertCreated();

    $this->assertDatabaseHas('stocks', [
        'product_id' => $this->product->id,
        'warehouse_id' => $this->pos->id,
        'quantity' => '-1000.000000',
    ]);
    $this->assertDatabaseCount('productables', 1);
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

it('sells mixed packaged variants and discounts their proportional quantity from granel', function (): void {
    $kilograms = UnitOfMeasure::query()->where('code', 'kg')->firstOrFail();
    $units = UnitOfMeasure::factory()->units()->create(['code' => 'NIU']);
    $template = ProductTemplate::query()->create([
        'name' => 'Arroz Extra',
        'is_active' => true,
        'is_pos_visible' => true,
    ]);
    $principal = Product::factory()->create([
        'product_template_id' => $template->id,
        'name' => 'Arroz Extra - Granel',
        'variant_name' => 'Granel',
        'sku' => 'ARROZ-MIX-GRANEL',
        'base_unit_id' => $kilograms->id,
        'sale_mode' => 'measured',
        'is_principal' => true,
    ]);
    $bag250 = Product::factory()->create([
        'product_template_id' => $template->id,
        'name' => 'Arroz Extra - Bolsa 250 g',
        'variant_name' => 'Bolsa 250 g',
        'sku' => 'ARROZ-MIX-250',
        'base_unit_id' => $units->id,
        'sale_mode' => 'unit',
        'content_quantity' => '0.25',
        'content_unit_id' => $kilograms->id,
        'is_principal' => false,
    ]);
    $bag1000 = Product::factory()->create([
        'product_template_id' => $template->id,
        'name' => 'Arroz Extra - Bolsa 1 kg',
        'variant_name' => 'Bolsa 1 kg',
        'sku' => 'ARROZ-MIX-1000',
        'base_unit_id' => $units->id,
        'sale_mode' => 'unit',
        'content_quantity' => 1,
        'content_unit_id' => $kilograms->id,
        'is_principal' => false,
    ]);
    PriceTier::factory()->for($bag250)->create([
        'min_quantity' => 1,
        'max_quantity' => null,
        'unit_price' => '3.0000',
    ]);
    PriceTier::factory()->for($bag1000)->create([
        'min_quantity' => 1,
        'max_quantity' => null,
        'unit_price' => '10.0000',
    ]);
    app(StockLedgerService::class)->registerIn(
        $principal,
        $this->pos,
        '10',
        '4.0000',
    );

    $response = $this->withHeaders($this->headers)->postJson('/api/v1/sales', [
        'warehouse_id' => $this->pos->id,
        'expected_total' => '32.00',
        'items' => [
            ['product_id' => $bag250->id, 'quantity' => 4, 'unit_code' => 'NIU'],
            ['product_id' => $bag1000->id, 'quantity' => 2, 'unit_code' => 'NIU'],
        ],
    ]);

    $response->assertCreated()
        ->assertJsonPath('data.payable_total', '32.00')
        ->assertJsonPath('data.items.0.stock_product_id', $principal->id)
        ->assertJsonPath('data.items.0.stock_quantity', '1.000000')
        ->assertJsonPath('data.items.1.stock_product_id', $principal->id)
        ->assertJsonPath('data.items.1.stock_quantity', '2.000000');

    $this->assertDatabaseHas('stocks', [
        'warehouse_id' => $this->pos->id,
        'product_id' => $principal->id,
        'quantity' => '7.000000',
    ]);
    $this->assertDatabaseMissing('stocks', ['product_id' => $bag250->id]);
    $this->assertDatabaseMissing('stocks', ['product_id' => $bag1000->id]);
    $saleId = $response->json('data.id');
    $this->assertDatabaseHas('inventory_movements', [
        'reference_type' => App\Models\Sale::class,
        'reference_id' => $saleId,
        'product_id' => $principal->id,
        'quantity' => '1.000000',
    ]);
    $this->assertDatabaseHas('inventory_movements', [
        'reference_type' => App\Models\Sale::class,
        'reference_id' => $saleId,
        'product_id' => $principal->id,
        'quantity' => '2.000000',
    ]);
});
