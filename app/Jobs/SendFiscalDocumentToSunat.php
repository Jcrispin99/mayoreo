<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\FiscalDocument;
use App\Services\FiscalDocumentTransmissionService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

/**
 * Sends a receipt/invoice to SUNAT in the background so the cashier doesn't
 * wait on SUNAT's response to close a sale. Success/failure (including the
 * CDR or rejection reason) is persisted on the FiscalDocument itself by
 * FiscalDocumentTransmissionService, so callers don't need this job's result.
 *
 * Failures are swallowed (only logged) rather than re-thrown: a SUNAT
 * rejection or outage must never surface as a failed job that retries and
 * spams the log, since it's already recorded on the document for someone to
 * review and re-send later.
 */
final class SendFiscalDocumentToSunat implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(
        public readonly FiscalDocument $fiscalDocument,
    ) {}

    public function handle(FiscalDocumentTransmissionService $transmissionService): void
    {
        try {
            $transmissionService->send($this->fiscalDocument);
        } catch (Throwable $exception) {
            report($exception);
        }
    }
}
