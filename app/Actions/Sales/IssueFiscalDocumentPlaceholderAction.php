<?php

declare(strict_types=1);

namespace App\Actions\Sales;

use App\Exceptions\FiscalDocumentAlreadyExchangedException;
use App\Exceptions\FiscalIdentityConfigurationException;
use App\Models\FiscalDocument;
use App\Models\FiscalIssuer;
use App\Models\Sale;
use App\Services\NextSequenceNumberService;
use Illuminate\Support\Facades\DB;

/**
 * Issues a boleta/factura placeholder in exchange for a sales ticket.
 * Inventory was already discounted when the sale was registered, so this
 * never touches stock — it only creates the fiscal document record and
 * marks the original ticket as exchanged. Real SUNAT integration (Greenter)
 * is wired in separately later.
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

    public function execute(Sale $sale, string $documentType): FiscalDocument
    {
        return DB::transaction(function () use ($sale, $documentType): FiscalDocument {
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

            $seriesCode = self::SERIES_BY_DOCUMENT_TYPE[$documentType];
            $number = $this->nextSequenceNumberService->generate(
                $documentType,
                $seriesCode,
                $ticket->fiscal_issuer_id,
            );

            $exchanged = FiscalDocument::query()->create([
                'sale_id' => $sale->id,
                ...$ticket->fiscalIdentitySnapshot(),
                'document_type' => $documentType,
                'series_code' => $seriesCode,
                'number' => $number,
                'status' => 'issued',
                'exchanged_from_document_id' => $ticket->id,
                'issued_at' => now(),
            ]);

            $ticket->update(['status' => 'exchanged']);

            return $exchanged;
        });
    }
}
