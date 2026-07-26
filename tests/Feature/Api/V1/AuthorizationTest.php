<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $user = User::factory()->create();
    $this->headers = ['Authorization' => 'Bearer '.$user->createToken('no-permissions')->plainTextToken];
});

it('denies access to protected endpoints for users without permissions', function (string $uri): void {
    $this->withHeaders($this->headers)
        ->getJson("/api/v1/{$uri}")
        ->assertForbidden();
})->with([
    'stores',
    'warehouses',
    'customers',
    'cash-registers',
    'cash-register-sessions',
    'document-series',
    'pos/payment-methods',
    'units-of-measure',
    'products',
    'stocks',
    'inventory-movements',
    'suppliers',
    'purchase-orders',
    'inventory-transfers',
    'sales',
    'sales/summary',
    'fiscal-issuers',
    'users',
    'roles',
    'permissions',
]);

it('allows access once the matching view permission is granted', function (): void {
    $user = User::factory()->create();
    grantApiPermissions($user, 'stores.view');
    $headers = ['Authorization' => 'Bearer '.$user->createToken('with-permission')->plainTextToken];

    $this->withHeaders($headers)->getJson('/api/v1/stores')->assertOk();
    $this->withHeaders($headers)->getJson('/api/v1/products')->assertForbidden();
});
