<?php

declare(strict_types=1);

use App\Enums\SunatEnvironment;
use App\Models\DocumentSeries;
use App\Models\FiscalCredential;
use App\Models\FiscalDocument;
use App\Models\FiscalIssuer;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\Productable;
use App\Models\Sale;
use App\Models\Stock;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\PreProductionCleanupSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Env;
use RuntimeException as CleanupRuntimeException;

uses(RefreshDatabase::class);

afterEach(function (): void {
    Env::getRepository()->clear('PRE_PRODUCTION_CLEANUP_CONFIRM');
});

it('requires an explicit RUC confirmation', function (): void {
    expect(fn () => $this->seed(PreProductionCleanupSeeder::class))
        ->toThrow(CleanupRuntimeException::class, 'Limpieza cancelada');
});

it('refuses to delete data after the issuer is in production', function (): void {
    Env::getRepository()->set('PRE_PRODUCTION_CLEANUP_CONFIRM', '10759997676');
    FiscalCredential::factory()->create(['environment' => SunatEnvironment::Production]);

    expect(fn () => $this->seed(PreProductionCleanupSeeder::class))
        ->toThrow(CleanupRuntimeException::class, 'existe un emisor configurado en producción');
});

it('removes test operations while preserving configuration and catalogues', function (): void {
    Env::getRepository()->set('PRE_PRODUCTION_CLEANUP_CONFIRM', '10759997676');

    $user = User::factory()->create();
    $issuer = FiscalIssuer::factory()->create();
    $credential = FiscalCredential::factory()->for($issuer)->create([
        'environment' => SunatEnvironment::Beta,
    ]);
    $warehouse = Warehouse::factory()->create();
    $product = Product::factory()->create();
    $sale = Sale::factory()->for($warehouse)->create();
    Productable::factory()->create([
        'product_id' => $product->id,
        'productable_type' => Sale::class,
        'productable_id' => $sale->id,
    ]);
    FiscalDocument::factory()->for($sale)->create([
        'fiscal_issuer_id' => $issuer->id,
        'document_type' => 'receipt',
        'series_code' => 'B001',
        'sunat_status' => 'accepted',
    ]);
    Stock::factory()->for($warehouse)->for($product)->create(['quantity' => 5]);
    InventoryMovement::factory()->for($warehouse)->for($product)->create();
    DocumentSeries::factory()->create([
        'fiscal_issuer_id' => $issuer->id,
        'document_type' => 'receipt',
        'series_code' => 'B001',
        'current_number' => 24,
    ]);

    $this->seed(PreProductionCleanupSeeder::class);

    expect(Sale::query()->count())->toBe(0)
        ->and(FiscalDocument::query()->count())->toBe(0)
        ->and(Productable::query()->count())->toBe(0)
        ->and(Stock::query()->count())->toBe(0)
        ->and(InventoryMovement::query()->count())->toBe(0)
        ->and(User::query()->whereKey($user->id)->exists())->toBeTrue()
        ->and(Product::query()->whereKey($product->id)->exists())->toBeTrue()
        ->and(FiscalCredential::query()->whereKey($credential->id)->exists())->toBeTrue()
        ->and(DocumentSeries::query()->where('series_code', 'B001')->value('current_number'))->toBe(0)
        ->and(DocumentSeries::query()->where('series_code', 'BC01')->exists())->toBeTrue()
        ->and(DocumentSeries::query()->where('series_code', 'FC01')->exists())->toBeTrue();
});
