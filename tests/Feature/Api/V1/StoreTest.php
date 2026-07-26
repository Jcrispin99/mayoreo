<?php

declare(strict_types=1);

use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\Store;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $user = User::factory()->create();
    grantApiPermissions($user, 'stores.view', 'stores.manage');
    $this->headers = ['Authorization' => 'Bearer '.$user->createToken('test-token')->plainTextToken];
});

it('creates a store with one default warehouse', function (): void {
    $response = $this->withHeaders($this->headers)->postJson('/api/v1/stores', [
        'code' => 'MIR',
        'name' => 'Tienda Miraflores',
        'address' => 'Av. Principal 123',
    ])->assertCreated();

    $response->assertJsonPath('data.code', 'MIR')
        ->assertJsonCount(1, 'data.warehouses')
        ->assertJsonPath('data.warehouses.0.code', 'MIR-PRINCIPAL')
        ->assertJsonPath('data.warehouses.0.is_default', true);
});

it('lists and updates stores with their warehouses', function (): void {
    $store = Store::factory()->create();
    $store->warehouses()->create([
        'code' => 'NORTE-PRINCIPAL',
        'name' => 'Almacén Norte',
        'type' => 'retail',
        'is_default' => true,
    ]);

    $this->withHeaders($this->headers)->getJson('/api/v1/stores')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonCount(1, 'data.0.warehouses');

    $this->withHeaders($this->headers)->putJson("/api/v1/stores/{$store->id}", [
        'name' => 'Tienda Norte actualizada',
        'is_active' => false,
    ])->assertOk()
        ->assertJsonPath('data.name', 'Tienda Norte actualizada')
        ->assertJsonPath('data.is_active', false);
});

it('deletes an unused store and its warehouses', function (): void {
    $store = Store::factory()->create();
    $warehouse = $store->warehouses()->create([
        'code' => 'TEMP-PRINCIPAL',
        'name' => 'Temporal',
        'type' => 'retail',
        'is_default' => true,
    ]);

    $this->withHeaders($this->headers)->deleteJson("/api/v1/stores/{$store->id}")
        ->assertNoContent();

    $this->assertDatabaseMissing('stores', ['id' => $store->id]);
    $this->assertDatabaseMissing('warehouses', ['id' => $warehouse->id]);
});

it('does not delete a store with inventory history', function (): void {
    $store = Store::factory()->create();
    $warehouse = $store->warehouses()->create([
        'code' => 'USED-PRINCIPAL',
        'name' => 'Con movimientos',
        'type' => 'retail',
        'is_default' => true,
    ]);
    $product = Product::factory()->create();
    InventoryMovement::factory()->for($product)->for($warehouse)->create();

    $this->withHeaders($this->headers)->deleteJson("/api/v1/stores/{$store->id}")
        ->assertUnprocessable();
});
