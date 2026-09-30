<?php

declare(strict_types=1);

namespace App\Actions\Sales;

use App\Exceptions\FiscalDocumentAlreadyExchangedException;
use App\Exceptions\FiscalIdentityConfigurationException;
use App\Exceptions\WholesaleSaleException;
use App\Jobs\SendFiscalDocumentToSunat;
use App\Models\DocumentSeries;
use App\Models\FiscalDocument;
use App\Models\FiscalIssuer;
use App\Models\Sale;
use App\Services\NextSequenceNumberService;
use Illuminate\Support\Facades\DB;

/**
 * Issues a boleta/factura in exchange for a sales ticket.
 * Inventory was already discounted when the sale was registered, so this
 * never touches stock — it only creates the fiscal document record and
 * marks the original ticket as exchanged. The resulting fiscal document is
 * queued for transmission to SUNAT after the database transaction commits.
 */
final readonly class IssueFiscalDocumentPlaceholderAction
{
    /**
     * @var array<string, string>
     */
    private const array SERIES_BY_DOCUMENT_TYPE = [
        'receipt' => 'B001',
        'invoice' => 'F001',
    ];

    public function __construct(
        private NextSequenceNumberService $nextSequenceNumberService,
    ) {}

    public function execute(Sale $sale, ?string $documentType, ?int $documentSeriesId = null): FiscalDocument
    {
        return DB::transaction(function () use ($sale, $documentType, $documentSeriesId): FiscalDocument {
            $ticket = $sale->fiscalDocuments()
                ->where('document_type', 'sales_ticket')
                ->where('status', 'issued')
                ->lockForUpdate()
                ->first();

            if (! $ticket instanceof FiscalDocument) {
                throw FiscalDocumentAlreadyExchangedException::forSale($sale->id);
            }

            if ($ticket->fiscal_issuer_id !== null) {
                $issuerIsActive = FiscalIssuer::query()
                    ->whereKey($ticket->fiscal_issuer_id)
                    ->where('is_active', true)
                    ->lockForUpdate()
                    ->exists();

                if (! $issuerIsActive) {
                    throw FiscalIdentityConfigurationException::inactiveIssuer(
                        $ticket->fiscal_issuer_id,
                    );
                }
            }

            $seriesQuery = DocumentSeries::query()
                ->where('fiscal_issuer_id', $ticket->fiscal_issuer_id)
                ->whereIn('document_type', ['receipt', 'invoice'])
                ->where('purpose', 'operational')
                ->where('is_active', true);

            if ($documentSeriesId !== null) {
                $seriesQuery->whereKey($documentSeriesId);
            } elseif ($documentType !== null) {
                $seriesQuery
                    ->where('document_type', $documentType)
                    ->where('series_code', self::SERIES_BY_DOCUMENT_TYPE[$documentType]);
            }

            $series = $seriesQuery->lockForUpdate()->orderBy('id')->first();

            if (! $series instanceof DocumentSeries
                || ($documentType !== null && $series->document_type !== $documentType)) {
                throw WholesaleSaleException::invalidSeries();
            }

            $documentType = $series->document_type;
            $this->validateCustomerForDocumentType($sale, $documentType);
            $number = $this->nextSequenceNumberService->generate(
                $documentType,
                $series->series_code,
                $ticket->fiscal_issuer_id,
            );

            $exchanged = FiscalDocument::query()->create([
                'sale_id' => $sale->id,
                ...$ticket->fiscalIdentitySnapshot(),
                'document_type' => $documentType,
                'series_code' => $series->series_code,
                'number' => $number,
                'status' => 'issued',
                'exchanged_from_document_id' => $ticket->id,
                'issued_at' => now(),
            ]);

            $ticket->update(['status' => 'exchanged']);

            SendFiscalDocumentToSunat::dispatch($exchanged)->afterCommit();

            return $exchanged;
        });
    }

    private function validateCustomerForDocumentType(Sale $sale, string $documentType): void
    {
        $customerDocument = mb_trim((string) $sale->customer_document);

        if ($documentType === 'invoice') {
            if (preg_match('/^\d{11}$/D', $customerDocument) !== 1
                || mb_trim((string) $sale->customer_name) === '') {
                throw WholesaleSaleException::invalidInvoiceCustomer();
            }

            return;
        }

        if ($customerDocument !== '' && preg_match('/^(?:\d{8}|\d{11})$/D', $customerDocument) !== 1) {
            throw WholesaleSaleException::invalidReceiptCustomer();
        }
    }
}
