<?php

declare(strict_types=1);

use App\Models\FiscalDocument;
use App\Models\FiscalDocumentDelivery;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SalePayment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->user = User::factory()->create();
    grantApiPermissions($this->user, 'sales.view', 'sales.manage');
    $this->headers = [
        'Authorization' => 'Bearer '.$this->user->createToken('receipt-delivery-test')->plainTextToken,
    ];
    $this->sale = Sale::factory()->create([
        'customer_name' => 'Cliente Prueba',
        'customer_document' => '12345678',
        'subtotal' => '25.0000',
        'total' => '25.0000',
        'payable_total' => '25.00',
    ]);
    $this->product = Product::factory()->create([
        'sku' => 'ARROZ-001',
        'name' => 'Arroz original',
    ]);
    $this->sale->items()->create([
        'product_id' => $this->product->id,
        'product_sku_snapshot' => 'ARROZ-001',
        'product_name_snapshot' => 'Arroz original',
        'unit_code_snapshot' => 'kg',
        'base_unit_code_snapshot' => 'kg',
        'quantity' => '2.000000',
        'input_quantity' => '2.000000',
        'input_unit_id' => $this->product->base_unit_id,
        'unit_price' => '12.5000',
        'line_total' => '25.0000',
    ]);
    SalePayment::query()->create([
        'sale_id' => $this->sale->id,
        'method' => 'cash',
        'amount' => '25.00',
        'received_amount' => '30.00',
        'change_amount' => '5.00',
        'status' => 'completed',
        'paid_at' => now(),
        'created_by' => $this->user->id,
    ]);
    $this->document = FiscalDocument::factory()->for($this->sale)->create([
        'document_type' => 'receipt',
        'series_code' => 'B001',
        'number' => 25,
        'issuer_ruc' => '20601234567',
        'issuer_legal_name' => 'Mayoreo Prueba SAC',
        'establishment_address' => 'Av. Prueba 123',
    ]);
});

it('returns printable html using the historical sale item snapshot', function (): void {
    $this->product->update(['name' => 'Nombre cambiado después']);

    $response = $this->withHeaders($this->headers)
        ->getJson("/api/v1/fiscal-documents/{$this->document->id}/representation");

    $response->assertOk()
        ->assertJsonPath('data.filename', 'B001-00000025.pdf');

    $html = (string) $response->json('data.html');
    expect($html)
        ->toContain('B001-00000025')
        ->toContain('Arroz original')
        ->not->toContain('Nombre cambiado después');
});

it('normalizes a Peruvian mobile and creates an auditable WhatsApp link', function (): void {
    $response = $this->withHeaders($this->headers)
        ->postJson("/api/v1/fiscal-documents/{$this->document->id}/deliveries", [
            'phone' => '987 654 321',
        ]);

    $response->assertCreated()
        ->assertJsonPath('data.phone', '+51987654321');

    expect((string) $response->json('data.public_url'))
        ->toContain('/comprobantes/');
    expect((string) $response->json('data.whatsapp_url'))
        ->toStartWith('https://wa.me/51987654321?text=');

    $this->assertDatabaseHas('fiscal_document_deliveries', [
        'fiscal_document_id' => $this->document->id,
        'channel' => 'whatsapp',
        'destination' => '+51987654321',
        'created_by' => $this->user->id,
    ]);

    $this->withHeaders($this->headers)
        ->getJson("/api/v1/sales/{$this->sale->id}")
        ->assertOk()
        ->assertJsonPath('data.delivery_phone', '+51987654321');

    $this->withHeaders($this->headers)
        ->getJson('/api/v1/sales?search=987654321')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $this->sale->id);
});

it('shows a shared receipt without authentication and records its first opening', function (): void {
    $delivery = FiscalDocumentDelivery::query()->create([
        'fiscal_document_id' => $this->document->id,
        'channel' => 'whatsapp',
        'destination' => '+51987654321',
        'access_token' => str_repeat('a', 64),
        'created_by' => $this->user->id,
    ]);

    $this->get("/comprobantes/{$delivery->access_token}")
        ->assertOk()
        ->assertSee('B001-00000025')
        ->assertSee('Cliente Prueba')
        ->assertSee('Imprimir comprobante');

    expect($delivery->fresh()?->opened_at)->not->toBeNull();
});

it('rejects an invalid WhatsApp number', function (): void {
    $this->withHeaders($this->headers)
        ->postJson("/api/v1/fiscal-documents/{$this->document->id}/deliveries", [
            'phone' => '123',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('phone');
});
