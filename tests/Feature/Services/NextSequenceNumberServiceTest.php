<?php

declare(strict_types=1);

use App\Exceptions\DocumentSeriesNotFoundException;
use App\Models\DocumentSeries;
use App\Models\FiscalIssuer;
use App\Services\NextSequenceNumberService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

describe('NextSequenceNumberService', function (): void {
    it('starts at 1 for a brand new series', function (): void {
        DocumentSeries::factory()->create([
            'document_type' => 'sales_ticket',
            'series_code' => 'NV01',
            'current_number' => 0,
        ]);

        $number = app(NextSequenceNumberService::class)->generate('sales_ticket', 'NV01');

        expect($number)->toBe(1);

        $this->assertDatabaseHas('document_series', [
            'document_type' => 'sales_ticket',
            'series_code' => 'NV01',
            'current_number' => 1,
        ]);
    });

    it('increments sequentially on repeated calls', function (): void {
        DocumentSeries::factory()->create([
            'document_type' => 'receipt',
            'series_code' => 'B001',
            'current_number' => 5,
        ]);

        $service = app(NextSequenceNumberService::class);

        expect($service->generate('receipt', 'B001'))->toBe(6)
            ->and($service->generate('receipt', 'B001'))->toBe(7)
            ->and($service->generate('receipt', 'B001'))->toBe(8);
    });

    it('keeps independent counters per document type and series code', function (): void {
        DocumentSeries::factory()->create([
            'document_type' => 'sales_ticket',
            'series_code' => 'NV01',
            'current_number' => 0,
        ]);
        DocumentSeries::factory()->create([
            'document_type' => 'invoice',
            'series_code' => 'F001',
            'current_number' => 0,
        ]);

        $service = app(NextSequenceNumberService::class);

        expect($service->generate('sales_ticket', 'NV01'))->toBe(1)
            ->and($service->generate('invoice', 'F001'))->toBe(1)
            ->and($service->generate('sales_ticket', 'NV01'))->toBe(2);
    });

    it('keeps the same series code independent for each fiscal issuer', function (): void {
        $firstIssuer = FiscalIssuer::factory()->create();
        $secondIssuer = FiscalIssuer::factory()->create();

        foreach ([$firstIssuer, $secondIssuer] as $issuer) {
            DocumentSeries::factory()->create([
                'fiscal_issuer_id' => $issuer->id,
                'document_type' => 'invoice',
                'series_code' => 'F001',
                'current_number' => 0,
            ]);
        }

        $service = app(NextSequenceNumberService::class);

        expect($service->generate('invoice', 'F001', $firstIssuer->id))->toBe(1)
            ->and($service->generate('invoice', 'F001', $secondIssuer->id))->toBe(1)
            ->and($service->generate('invoice', 'F001', $firstIssuer->id))->toBe(2);
    });

    it('never repeats or skips a number across many sequential calls', function (): void {
        DocumentSeries::factory()->create([
            'document_type' => 'sales_ticket',
            'series_code' => 'NV01',
            'current_number' => 0,
        ]);

        $service = app(NextSequenceNumberService::class);

        $numbers = [];
        for ($i = 0; $i < 25; $i++) {
            $numbers[] = $service->generate('sales_ticket', 'NV01');
        }

        expect($numbers)->toBe(range(1, 25));
    });

    it('throws when the series does not exist', function (): void {
        app(NextSequenceNumberService::class)->generate('invoice', 'DOES-NOT-EXIST');
    })->throws(DocumentSeriesNotFoundException::class);

    it('throws when the series is inactive', function (): void {
        DocumentSeries::factory()->inactive()->create([
            'document_type' => 'invoice',
            'series_code' => 'F001',
        ]);

        app(NextSequenceNumberService::class)->generate('invoice', 'F001');
    })->throws(DocumentSeriesNotFoundException::class);
});
