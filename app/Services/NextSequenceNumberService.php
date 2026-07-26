<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\DocumentSeriesNotFoundException;
use App\Models\DocumentSeries;
use Illuminate\Support\Facades\DB;

final class NextSequenceNumberService
{
    /**
     * Atomically increments and returns the next correlative number for a
     * document series, so concurrent callers (e.g. multiple POS registers)
     * never receive a duplicate or skipped number.
     */
    public function generate(
        string $documentType,
        string $seriesCode,
        ?int $fiscalIssuerId = null,
    ): int {
        return DB::transaction(function () use ($documentType, $seriesCode, $fiscalIssuerId): int {
            $series = DocumentSeries::query()
                ->where('fiscal_issuer_id', $fiscalIssuerId)
                ->where('document_type', $documentType)
                ->where('series_code', $seriesCode)
                ->where('is_active', true)
                ->lockForUpdate()
                ->first();

            if (! $series instanceof DocumentSeries) {
                throw DocumentSeriesNotFoundException::forTypeAndCode($documentType, $seriesCode);
            }

            $series->current_number++;
            $series->save();

            return $series->current_number;
        });
    }
}
