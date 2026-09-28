<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $user = User::factory()->create();
    grantApiPermissions($user, 'suppliers.view', 'suppliers.manage');
    $this->headers = ['Authorization' => 'Bearer '.$user->createToken('supplier-test')->plainTextToken];
});

it('creates a supplier with only its name', function (): void {
    $this->withHeaders($this->headers)
        ->postJson('/api/v1/suppliers', [
            'name' => 'Distribuidora Central',
        ])
        ->assertCreated()
        ->assertJsonPath('data.name', 'Distribuidora Central')
        ->assertJsonPath('data.document_number', null)
        ->assertJsonPath('data.phone', null)
        ->assertJsonPath('data.email', null)
        ->assertJsonPath('data.is_active', true);

    $this->assertDatabaseHas('suppliers', [
        'name' => 'Distribuidora Central',
        'document_number' => null,
        'phone' => null,
        'email' => null,
        'is_active' => true,
    ]);
});

it('requires the supplier name', function (): void {
    $this->withHeaders($this->headers)
        ->postJson('/api/v1/suppliers', [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('name');
});
