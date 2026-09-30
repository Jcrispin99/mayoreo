<?php

declare(strict_types=1);

use App\Jobs\SendFiscalDocumentToSunat;
use App\Models\DocumentSeries;
use App\Models\InventoryMovement;
use App\Models\PriceTier;
use App\Models\Product;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\StockLedgerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Queue::fake();
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
    Queue::assertPushed(SendFiscalDocumentToSunat::class, 1);
});

it('exchanges a sales ticket for a factura', function (): void {
    App\Models\Sale::query()->whereKey($this->sale['id'])->update([
        'customer_name' => 'Empresa Demo SAC',
        'customer_document' => '20601234567',
    ]);

    $response = $this->withHeaders($this->headers)
        ->postJson("/api/v1/sales/{$this->sale['id']}/fiscal-documents", ['document_type' => 'invoice']);

    $response->assertCreated()->assertJson([
        'data' => ['document_type' => 'invoice', 'series_code' => 'F001', 'number' => 1],
    ]);
});

it('uses the fiscal series selected from mobile when exchanging a ticket', function (): void {
    $selectedSeries = DocumentSeries::factory()->create([
        'document_type' => 'receipt',
        'series_code' => 'B009',
        'current_number' => 40,
    ]);

    $this->withHeaders($this->headers)
        ->postJson("/api/v1/sales/{$this->sale['id']}/fiscal-documents", [
            'document_type' => 'receipt',
            'document_series_id' => $selectedSeries->id,
        ])
        ->assertCreated()
        ->assertJsonPath('data.full_number', 'B009-41');

    expect($selectedSeries->fresh()?->current_number)->toBe(41);
});

it('rejects exchanging a ticket for an invoice without a customer RUC', function (): void {
    $this->withHeaders($this->headers)
        ->postJson("/api/v1/sales/{$this->sale['id']}/fiscal-documents", [
            'document_type' => 'invoice',
        ])
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Para emitir una factura selecciona un cliente con razón social y RUC de 11 dígitos.');
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
