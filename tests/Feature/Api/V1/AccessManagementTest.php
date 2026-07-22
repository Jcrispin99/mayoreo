<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $actor = User::factory()->create();
    $this->headers = ['Authorization' => 'Bearer '.$actor->createToken('test-token')->plainTextToken];
});

it('creates, updates and lists a user', function (): void {
    $user = $this->withHeaders($this->headers)->postJson('/api/v1/users', [
        'name' => 'Ana Torres',
        'email' => 'ana@example.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ])->assertCreated()->json('data');

    $this->withHeaders($this->headers)->putJson("/api/v1/users/{$user['id']}", [
        'name' => 'Ana actualizada',
    ])->assertOk()->assertJsonPath('data.name', 'Ana actualizada');

    $this->withHeaders($this->headers)->getJson('/api/v1/users')
        ->assertOk()->assertJsonCount(2, 'data');
});

it('creates a role with permissions and assigns multiple roles to a user', function (): void {
    Permission::findOrCreate('products.view', 'web');
    Permission::findOrCreate('products.update', 'web');

    $role = $this->withHeaders($this->headers)->postJson('/api/v1/roles', [
        'name' => 'catalog-manager',
        'permissions' => ['products.view', 'products.update'],
    ])->assertCreated()->json('data');

    expect($role['permissions'])->toHaveCount(2);

    Role::findOrCreate('seller', 'web');
    $user = User::factory()->create();

    $this->withHeaders($this->headers)->putJson("/api/v1/users/{$user->id}/roles", [
        'roles' => ['catalog-manager', 'seller'],
    ])->assertOk()->assertJsonCount(2, 'data.roles');

    $this->withHeaders($this->headers)->putJson("/api/v1/users/{$user->id}/roles", [
        'roles' => [],
    ])->assertOk()->assertJsonCount(0, 'data.roles');
});

it('lists permissions and updates a role selection', function (): void {
    $permission = Permission::findOrCreate('inventory.manage', 'web');
    $role = Role::findOrCreate('inventory-manager', 'web');

    $this->withHeaders($this->headers)->getJson('/api/v1/permissions')
        ->assertOk()->assertJsonCount(1, 'data');

    $this->withHeaders($this->headers)->putJson("/api/v1/roles/{$role->id}", [
        'permissions' => [$permission->name],
    ])->assertOk()->assertJsonPath('data.permissions.0.name', 'inventory.manage');
});
