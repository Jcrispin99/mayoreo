<?php

declare(strict_types=1);

namespace App\Actions\Sales;

use App\Exceptions\CreditNoteException;
use App\Jobs\SendFiscalDocumentToSunat;
use App\Models\DocumentSeries;
use App\Models\FiscalDocument;
use App\Models\Product;
use App\Models\Productable;
use App\Models\Sale;
use App\Models\UnitOfMeasure;
use App\Models\Warehouse;
use App\Services\FiscalDocumentIdentityService;
use App\Services\NextSequenceNumberService;
use App\Services\StockLedgerService;
use Illuminate\Support\Facades\DB;

/**
 * Issues a Nota de Crédito (SUNAT Catálogo 01, código 07) against an
 * already-accepted boleta/factura, returning the credited items to stock.
 * Only one credit note per original document is supported — a document
 * that already has one can't be credited again.
 */
final readonly class IssueCreditNoteAction
{
    /**
     * SUNAT Catálogo 09 (motivo de nota de crédito).
     *
     * @var array<string, string>
     */
    public const array RETURN_REASON_CODES = [
        '06' => 'Devolución total',
        '07' => 'Devolución por ítem',
    ];

    public function __construct(
        private NextSequenceNumberService $nextSequenceNumberService,
        private FiscalDocumentIdentityService $fiscalDocumentIdentityService,
        private StockLedgerService $stockLedgerService,
    ) {}

    /**
     * @param  list<array{sale_item_id: int, quantity: numeric-string}>  $items
     */
    public function execute(
        FiscalDocument $originalDocument,
        string $reasonCode,
        ?string $reasonDescription,
        array $items,
        int $createdBy,
    ): FiscalDocument {
        if (! array_key_exists($reasonCode, self::RETURN_REASON_CODES)) {
            throw CreditNoteException::invalidReasonCode($reasonCode);
        }

        if ($items === []) {
            throw CreditNoteException::emptyItems();
        }

        return DB::transaction(function () use ($originalDocument, $reasonCode, $reasonDescription, $items, $createdBy): FiscalDocument {
            $original = FiscalDocument::query()->lockForUpdate()->findOrFail($originalDocument->id);

            if (! in_array($original->document_type, ['receipt', 'invoice'], true)) {
                throw CreditNoteException::unsupportedDocumentType($original->document_type);
            }

            if (! in_array($original->sunat_status, ['accepted', 'observed'], true)) {
                throw CreditNoteException::documentNotAccepted($original->id);
            }

            $alreadyCredited = FiscalDocument::query()
                ->where('affected_document_id', $original->id)
                ->lockForUpdate()
                ->exists();

            if ($alreadyCredited) {
                throw CreditNoteException::alreadyCredited($original->id);
            }

            $sale = Sale::query()
                ->with(['items.product.baseUnit', 'warehouse'])
                ->lockForUpdate()
                ->findOrFail($original->sale_id);

            $warehouse = $sale->warehouse;
            assert($warehouse instanceof Warehouse);

            $saleItemsById = $sale->items->keyBy('id');
            /** @var list<array{sale_item_id: int, product_id: int, product_sku: string, product_name: string, unit_code: string, quantity: string, unit_price: string, line_total: string}> $snapshot */
            $snapshot = [];
            $selectedSaleItemIds = [];

            foreach ($items as $requested) {
                if (isset($selectedSaleItemIds[$requested['sale_item_id']])) {
                    throw CreditNoteException::duplicateItem($requested['sale_item_id']);
                }

                $selectedSaleItemIds[$requested['sale_item_id']] = true;
                $saleItem = $saleItemsById->get($requested['sale_item_id']);

                if (! $saleItem instanceof Productable) {
                    throw CreditNoteException::itemNotInSale($requested['sale_item_id'], $sale->id);
                }

                /** @var numeric-string $quantity */
                $quantity = (string) $requested['quantity'];

                if (bccomp($quantity, '0', 6) <= 0 || bccomp($quantity, (string) $saleItem->quantity, 6) > 0) {
                    throw CreditNoteException::invalidQuantity($saleItem->id, $quantity);
                }

                $product = $saleItem->product;
                $baseUnit = $product?->baseUnit;
                assert($product instanceof Product && $baseUnit instanceof UnitOfMeasure);

                /** @var numeric-string $unitPrice */
                $unitPrice = (string) $saleItem->unit_price;
                /** @var numeric-string $lineTotal */
                $lineTotal = bcmul($quantity, $unitPrice, 4);

                $snapshot[] = [
                    'sale_item_id' => $saleItem->id,
                    'product_id' => $product->id,
                    'product_sku' => $product->sku,
                    'product_name' => $product->name,
                    'unit_code' => $baseUnit->code,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'line_total' => $lineTotal,
                ];
            }

            if ($reasonCode === '06') {
                $requestedQuantities = collect($snapshot)
                    ->mapWithKeys(static fn (array $item): array => [
                        $item['sale_item_id'] => $item['quantity'],
                    ]);

                $isCompleteReturn = $sale->items->every(
                    static fn (Productable $item): bool => $requestedQuantities->has($item->id)
                        && bccomp((string) $requestedQuantities->get($item->id), (string) $item->quantity, 6) === 0,
                );

                if (! $isCompleteReturn || $requestedQuantities->count() !== $sale->items->count()) {
                    throw CreditNoteException::incompleteTotalReturn();
                }
            }

            $requiredSeriesPrefix = $original->document_type === 'receipt' ? 'B' : 'F';

            $series = DocumentSeries::query()
                ->where('fiscal_issuer_id', $original->fiscal_issuer_id)
                ->where('document_type', 'credit_note')
                ->where('series_code', 'like', $requiredSeriesPrefix.'%')
                ->where('is_active', true)
                ->orderBy('series_code')
                ->lockForUpdate()
                ->first();

            if (! $series instanceof DocumentSeries) {
                throw CreditNoteException::noActiveSeries(
                    (int) $original->fiscal_issuer_id,
                    $requiredSeriesPrefix,
                    $original->document_type,
                );
            }

            $fiscalIdentity = $this->fiscalDocumentIdentityService->snapshot($warehouse, $series);
            $number = $this->nextSequenceNumberService->generate(
                'credit_note',
                $series->series_code,
                $series->fiscal_issuer_id,
            );

            $creditNote = FiscalDocument::query()->create([
                'sale_id' => $sale->id,
                ...$fiscalIdentity,
                'document_type' => 'credit_note',
                'series_code' => $series->series_code,
                'number' => $number,
                'status' => 'issued',
                'affected_document_id' => $original->id,
                'reason_code' => $reasonCode,
                'reason_description' => $reasonDescription ?? self::RETURN_REASON_CODES[$reasonCode],
                'credit_note_items' => $snapshot,
                'issued_at' => now(),
            ]);

            foreach ($snapshot as $item) {
                $product = Product::query()->lockForUpdate()->findOrFail($item['product_id']);
                $stock = $this->stockLedgerService->balance($product, $warehouse);

                $this->stockLedgerService->registerIn(
                    $product,
                    $warehouse,
                    $item['quantity'],
                    (string) $stock->average_cost,
                    'sale_return',
                    $creditNote,
                    "Devolución de {$original->series_code}-{$original->number}",
                    $createdBy,
                );
            }

            SendFiscalDocumentToSunat::dispatch($creditNote)->afterCommit();

            return $creditNote->fresh(['sale', 'affectedDocument']) ?? $creditNote;
        });
    }
}
