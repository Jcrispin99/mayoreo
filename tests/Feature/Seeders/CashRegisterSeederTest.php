<?php

declare(strict_types=1);

use App\Models\CashRegister;
use Database\Seeders\CashRegisterSeeder;
use Database\Seeders\DocumentSeriesSeeder;
use Database\Seeders\FiscalIssuerSeeder;
use Database\Seeders\WarehouseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('configures the main register with note, receipt and invoice support', function (): void {
    $this->seed([
        DocumentSeriesSeeder::class,
        WarehouseSeeder::class,
        FiscalIssuerSeeder::class,
        CashRegisterSeeder::class,
    ]);

    $register = CashRegister::query()
        ->with(['warehouse', 'defaultSalesSeries', 'salesSeries'])
        ->where('code', 'CAJA-01')
        ->firstOrFail();

    expect($register->warehouse?->code)->toBe('MAIN')
        ->and($register->defaultSalesSeries?->series_code)->toBe('NV01')
        ->and($register->salesSeries->pluck('series_code')->sort()->values()->all())
        ->toBe(['B001', 'F001', 'NV01']);

    $this->seed(CashRegisterSeeder::class);

    expect(CashRegister::query()->where('code', 'CAJA-01')->count())->toBe(1)
        ->and($register->fresh()?->salesSeries()->count())->toBe(3);
});
