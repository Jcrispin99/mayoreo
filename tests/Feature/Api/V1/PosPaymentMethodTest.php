<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $user = User::factory()->create();
    $this->headers = ['Authorization' => 'Bearer '.$user->createToken('test-token')->plainTextToken];
});

it('returns the closed POS payment method catalog with its checkout capabilities', function (): void {
    $response = $this->withHeaders($this->headers)
        ->getJson('/api/v1/pos/payment-methods')
        ->assertOk()
        ->assertJsonCount(5, 'data')
        ->assertJsonPath('data.0.code', 'cash')
        ->assertJsonPath('data.0.label', 'Efectivo')
        ->assertJsonPath('data.0.requires_received_amount', true)
        ->assertJsonPath('data.0.supports_reference', false)
        ->assertJsonPath('data.1.code', 'card')
        ->assertJsonPath('data.1.requires_received_amount', false)
        ->assertJsonPath('data.1.supports_reference', true);

    expect($response->json('data.*.code'))->toBe([
        'cash',
        'card',
        'yape',
        'plin',
        'bank_transfer',
    ]);
});

it('requires authentication to list POS payment methods', function (): void {
    $this->getJson('/api/v1/pos/payment-methods')->assertUnauthorized();
});
