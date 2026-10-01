<?php

declare(strict_types=1);

use App\Models\CashRegister;
use App\Models\DocumentSeries;
use Database\Seeders\CashRegisterSeeder;
use Database\Seeders\DocumentSeriesSeeder;
use Database\Seeders\FiscalIssuerSeeder;
use Database\Seeders\WarehouseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function seedRegistersAndSeries(object $test): void
{
    $test->seed([
        DocumentSeriesSeeder::class,
        WarehouseSeeder::class,
        FiscalIssuerSeeder::class,
        CashRegisterSeeder::class,
    ]);
}

it('seeds three registers, each defaulting to its own nota de venta series', function (): void {
    seedRegistersAndSeries($this);

    $registers = CashRegister::query()
        ->with(['warehouse', 'defaultSalesSeries', 'salesSeries'])
        ->orderBy('code')
        ->get();

    expect($registers->pluck('code')->all())->toBe(['CAJA-01', 'CAJA-02', 'CAJA-03'])
        ->and($registers->pluck('name')->all())->toBe(['Caja 1', 'Caja 2', 'Caja 3'])
        ->and($registers->map(fn (CashRegister $register): ?string => $register->warehouse?->code)->unique()->values()->all())
        ->toBe(['MAIN'])
        ->and($registers->map(fn (CashRegister $register): ?string => $register->defaultSalesSeries?->series_code)->all())
        ->toBe(['NV01', 'NV02', 'NV03'])
        ->and($registers->map(fn (CashRegister $register): array => $register->salesSeries->pluck('series_code')->all())->all())
        ->toBe([['NV01'], ['NV02'], ['NV03']]);
});

it('creates boleta and factura series for the issuer without assigning them to any register', function (): void {
    seedRegistersAndSeries($this);

    $fiscalSeries = DocumentSeries::query()
        ->with('cashRegisters')
        ->where('purpose', 'operational')
        ->whereIn('document_type', ['receipt', 'invoice'])
        ->orderBy('series_code')
        ->get();

    expect($fiscalSeries->pluck('series_code')->all())->toBe(['B001', 'B002', 'B003', 'F001', 'F002', 'F003'])
        ->and($fiscalSeries->every(fn (DocumentSeries $series): bool => $series->cashRegisters->isEmpty()))->toBeTrue()
        ->and($fiscalSeries->every(fn (DocumentSeries $series): bool => $series->fiscal_issuer_id !== null))->toBeTrue();
});

it('can run again without duplicating registers or series', function (): void {
    seedRegistersAndSeries($this);
    seedRegistersAndSeries($this);

    expect(CashRegister::query()->count())->toBe(3)
        ->and(DocumentSeries::query()->where('document_type', 'sales_ticket')->count())->toBe(3)
        ->and(DocumentSeries::query()->where('purpose', 'operational')->whereIn('document_type', ['receipt', 'invoice'])->count())->toBe(6)
        ->and(CashRegister::query()->where('code', 'CAJA-01')->firstOrFail()->salesSeries()->count())->toBe(1);
});
