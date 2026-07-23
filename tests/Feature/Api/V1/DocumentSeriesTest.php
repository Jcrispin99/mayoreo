<?php

declare(strict_types=1);

use App\Models\DocumentSeries;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $user = User::factory()->create();
    $this->headers = ['Authorization' => 'Bearer '.$user->createToken('document-series-test')->plainTextToken];
});

it('lists only sales series and filters active records', function (): void {
    DocumentSeries::factory()->create(['document_type' => 'sales_ticket', 'series_code' => 'NV01']);
    DocumentSeries::factory()->create(['document_type' => 'invoice', 'series_code' => 'F001', 'is_active' => false]);

    $this->withHeaders($this->headers)
        ->getJson('/api/v1/document-series?is_active=true')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.series_code', 'NV01');
});

it('creates and updates an unused sales series', function (): void {
    $created = $this->withHeaders($this->headers)
        ->postJson('/api/v1/document-series', [
            'document_type' => 'receipt',
            'series_code' => 'b010',
            'current_number' => 0,
            'is_active' => true,
        ])
        ->assertCreated()
        ->assertJsonPath('data.series_code', 'B010')
        ->json('data');

    $this->withHeaders($this->headers)
        ->putJson("/api/v1/document-series/{$created['id']}", [
            'document_type' => 'receipt',
            'series_code' => 'B011',
            'current_number' => 0,
            'is_active' => false,
        ])
        ->assertOk()
        ->assertJsonPath('data.series_code', 'B011')
        ->assertJsonPath('data.is_active', false);
});

it('does not allow editing identity or correlative after use', function (): void {
    $series = DocumentSeries::factory()->create([
        'document_type' => 'sales_ticket',
        'series_code' => 'NV01',
        'current_number' => 25,
    ]);

    $this->withHeaders($this->headers)
        ->putJson("/api/v1/document-series/{$series->id}", [
            'document_type' => 'invoice',
            'series_code' => 'F099',
            'current_number' => 1,
            'is_active' => false,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['document_type', 'series_code', 'current_number']);
});

it('rejects purchase series through the sales series endpoint', function (): void {
    $this->withHeaders($this->headers)
        ->postJson('/api/v1/document-series', [
            'document_type' => 'purchase',
            'series_code' => 'OC99',
            'current_number' => 0,
            'is_active' => true,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('document_type');
});
