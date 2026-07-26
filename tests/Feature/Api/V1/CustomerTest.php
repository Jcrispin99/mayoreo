<?php

declare(strict_types=1);

use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $user = User::factory()->create();
    grantApiPermissions($user, 'customers.view', 'customers.manage');
    $this->headers = ['Authorization' => 'Bearer '.$user->createToken('test-token')->plainTextToken];
});

it('creates and shows a customer', function (): void {
    $response = $this->withHeaders($this->headers)->postJson('/api/v1/customers', [
        'name' => '  Comercial Los Olivos  ',
        'document_number' => ' 20601234567 ',
        'phone' => '987654321',
        'email' => ' VENTAS@LOSOLIVOS.PE ',
        'address' => 'Av. Los Olivos 123',
        'is_active' => true,
    ])->assertCreated()
        ->assertJsonPath('data.name', 'Comercial Los Olivos')
        ->assertJsonPath('data.document_number', '20601234567')
        ->assertJsonPath('data.is_active', true);

    $customerId = $response->json('data.id');

    $this->assertDatabaseHas('customers', [
        'id' => $customerId,
        'document_number' => '20601234567',
        'email' => 'ventas@losolivos.pe',
    ]);

    $this->withHeaders($this->headers)
        ->getJson("/api/v1/customers/{$customerId}")
        ->assertOk()
        ->assertJsonPath('data.address', 'Av. Los Olivos 123');
});

it('validates customer fields and unique document numbers', function (): void {
    Customer::factory()->create(['document_number' => '12345678']);

    $this->withHeaders($this->headers)->postJson('/api/v1/customers', [
        'name' => '',
        'document_number' => '12345678',
        'email' => 'correo-invalido',
    ])->assertUnprocessable()
        ->assertJsonValidationErrors(['name', 'document_number', 'email']);
});

it('lists, searches and filters customers', function (): void {
    Customer::factory()->create([
        'name' => 'Ana Torres',
        'document_number' => '44556677',
        'is_active' => true,
    ]);
    Customer::factory()->create([
        'name' => 'Bodega Central',
        'document_number' => '20111111111',
        'is_active' => false,
    ]);

    $this->withHeaders($this->headers)
        ->getJson('/api/v1/customers?search=44556677')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Ana Torres');

    $this->withHeaders($this->headers)
        ->getJson('/api/v1/customers?is_active=0')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Bodega Central');
});

it('updates a customer while preserving its own unique document number', function (): void {
    $customer = Customer::factory()->create([
        'name' => 'Cliente inicial',
        'document_number' => '87654321',
    ]);

    $this->withHeaders($this->headers)->putJson("/api/v1/customers/{$customer->id}", [
        'name' => 'Cliente actualizado',
        'document_number' => '87654321',
        'phone' => null,
        'is_active' => false,
    ])->assertOk()
        ->assertJsonPath('data.name', 'Cliente actualizado')
        ->assertJsonPath('data.phone', null)
        ->assertJsonPath('data.is_active', false);
});

it('deletes a customer', function (): void {
    $customer = Customer::factory()->create();

    $this->withHeaders($this->headers)
        ->deleteJson("/api/v1/customers/{$customer->id}")
        ->assertNoContent();

    $this->assertDatabaseMissing('customers', ['id' => $customer->id]);
});

it('does not delete a customer with registered sales', function (): void {
    $customer = Customer::factory()->create();
    App\Models\Sale::factory()->for($customer)->create();

    $this->withHeaders($this->headers)
        ->deleteJson("/api/v1/customers/{$customer->id}")
        ->assertUnprocessable();

    $this->assertDatabaseHas('customers', ['id' => $customer->id]);
});

it('requires authentication for customer endpoints', function (): void {
    $customer = Customer::factory()->create();

    $this->getJson('/api/v1/customers')->assertUnauthorized();
    $this->postJson('/api/v1/customers', ['name' => 'Sin sesión'])->assertUnauthorized();
    $this->getJson("/api/v1/customers/{$customer->id}")->assertUnauthorized();
});
