<?php

declare(strict_types=1);

use App\Models\DocumentSeries;
use App\Models\InventoryMovement;
use App\Models\PriceTier;
use App\Models\Product;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\StockLedgerService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    DocumentSeries::factory()->create(['document_type' => 'sales_ticket', 'series_code' => 'NV01']);
    DocumentSeries::factory()->create(['document_type' => 'receipt', 'series_code' => 'B001']);
    DocumentSeries::factory()->create(['document_type' => 'invoice', 'series_code' => 'F001']);

    $user = User::factory()->create();
    grantApiPermissions($user, 'sales.view', 'sales.manage');
    $this->headers = ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    $this->pos = Warehouse::factory()->pos()->create();
    $this->product = Product::factory()->create();

    PriceTier::factory()->for($this->product)->create(['min_quantity' => 0, 'max_quantity' => null, 'unit_price' => 10]);
    app(StockLedgerService::class)->registerIn($this->product, $this->pos, '1000', '5.0000', 'purchase');

    $this->sale = $this->withHeaders($this->headers)->postJson('/api/v1/sales', [
        'warehouse_id' => $this->pos->id,
        'items' => [['product_id' => $this->product->id, 'quantity' => 100]],
    ])->json('data');
});

it('exchanges a sales ticket for a boleta without touching inventory again', function (): void {
    $movementsBefore = InventoryMovement::query()->count();

    $response = $this->withHeaders($this->headers)
        ->postJson("/api/v1/sales/{$this->sale['id']}/fiscal-documents", ['document_type' => 'receipt']);

    $response->assertCreated()->assertJson([
        'data' => [
            'document_type' => 'receipt',
            'series_code' => 'B001',
            'number' => 1,
            'status' => 'issued',
        ],
    ]);

    expect(InventoryMovement::query()->count())->toBe($movementsBefore);

    $this->assertDatabaseHas('fiscal_documents', [
        'sale_id' => $this->sale['id'],
        'document_type' => 'sales_ticket',
        'status' => 'exchanged',
    ]);
});

it('exchanges a sales ticket for a factura', function (): void {
    $response = $this->withHeaders($this->headers)
        ->postJson("/api/v1/sales/{$this->sale['id']}/fiscal-documents", ['document_type' => 'invoice']);

    $response->assertCreated()->assertJson([
        'data' => ['document_type' => 'invoice', 'series_code' => 'F001', 'number' => 1],
    ]);
});

it('rejects a second exchange for the same ticket', function (): void {
    $this->withHeaders($this->headers)
        ->postJson("/api/v1/sales/{$this->sale['id']}/fiscal-documents", ['document_type' => 'receipt'])
        ->assertCreated();

    $this->withHeaders($this->headers)
        ->postJson("/api/v1/sales/{$this->sale['id']}/fiscal-documents", ['document_type' => 'invoice'])
        ->assertUnprocessable();
});

it('lists all fiscal documents for a sale', function (): void {
    $this->withHeaders($this->headers)
        ->postJson("/api/v1/sales/{$this->sale['id']}/fiscal-documents", ['document_type' => 'receipt'])
        ->assertCreated();

    $response = $this->withHeaders($this->headers)->getJson("/api/v1/sales/{$this->sale['id']}/fiscal-documents");

    $response->assertOk()->assertJsonCount(2, 'data');
});
