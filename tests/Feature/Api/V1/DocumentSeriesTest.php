<?php

declare(strict_types=1);

use App\Models\DocumentSeries;
use App\Models\FiscalIssuer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $user = User::factory()->create();
    grantApiPermissions($user, 'pos-config.view', 'pos-config.manage');
    $this->headers = ['Authorization' => 'Bearer '.$user->createToken('document-series-test')->plainTextToken];
    $this->issuer = FiscalIssuer::factory()->create();
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
            'fiscal_issuer_id' => $this->issuer->id,
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
            'fiscal_issuer_id' => $this->issuer->id,
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
        'fiscal_issuer_id' => $this->issuer->id,
        'document_type' => 'sales_ticket',
        'series_code' => 'NV01',
        'current_number' => 25,
    ]);

    $this->withHeaders($this->headers)
        ->putJson("/api/v1/document-series/{$series->id}", [
            'fiscal_issuer_id' => $this->issuer->id,
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
            'fiscal_issuer_id' => $this->issuer->id,
            'document_type' => 'purchase',
            'series_code' => 'OC99',
            'current_number' => 0,
            'is_active' => true,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('document_type');
});

it('allows the same series code for different fiscal issuers', function (): void {
    $otherIssuer = FiscalIssuer::factory()->create();

    foreach ([$this->issuer, $otherIssuer] as $issuer) {
        $this->withHeaders($this->headers)
            ->postJson('/api/v1/document-series', [
                'fiscal_issuer_id' => $issuer->id,
                'document_type' => 'invoice',
                'series_code' => 'F001',
                'current_number' => 0,
                'is_active' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.fiscal_issuer_id', $issuer->id);
    }

    $this->withHeaders($this->headers)
        ->postJson('/api/v1/document-series', [
            'fiscal_issuer_id' => $this->issuer->id,
            'document_type' => 'invoice',
            'series_code' => 'F001',
            'current_number' => 0,
            'is_active' => true,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('series_code');
});
