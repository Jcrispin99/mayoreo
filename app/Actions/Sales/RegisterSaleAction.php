<?php

declare(strict_types=1);

namespace App\Actions\Sales;

use App\Actions\Pricing\ResolvePriceTierAction;
use App\Exceptions\IncompatibleUnitException;
use App\Models\FiscalDocument;
use App\Models\Product;
use App\Models\Sale;
use App\Models\Warehouse;
use App\Services\NextSequenceNumberService;
use App\Services\StockLedgerService;
use Illuminate\Support\Facades\DB;

final readonly class RegisterSaleAction
{
    private const DEFAULT_TICKET_SERIES = 'NV01';

    public function __construct(
        private ResolvePriceTierAction $resolvePriceTierAction,
        private StockLedgerService $stockLedgerService,
        private NextSequenceNumberService $nextSequenceNumberService,
    ) {}

    /**
     * @param  array<int, array{product_id: int, quantity: float|string, unit_id: int|null}>  $items
     */
    public function execute(
        Warehouse $warehouse,
        array $items,
        ?string $customerName = null,
        ?string $customerDocument = null,
        ?int $createdBy = null,
    ): Sale {
        return DB::transaction(function () use ($warehouse, $items, $customerName, $customerDocument, $createdBy): Sale {
            $sale = Sale::query()->create([
                'warehouse_id' => $warehouse->id,
                'customer_name' => $customerName,
                'customer_document' => $customerDocument,
                'status' => 'completed',
                'subtotal' => 0,
                'total' => 0,
                'sold_at' => now(),
                'created_by' => $createdBy,
            ]);

            $subtotal = '0';

            foreach ($items as $item) {
                $product = Product::query()->findOrFail($item['product_id']);
                $quantity = (string) $item['quantity'];

                if (! empty($item['unit_id']) && (int) $item['unit_id'] !== $product->base_unit_id) {
                    throw IncompatibleUnitException::unitDoesNotMatchProductBaseUnit((int) $item['unit_id'], $product->id);
                }

                $priceTier = $this->resolvePriceTierAction->execute($product, $quantity);

                $this->stockLedgerService->registerOut($product, $warehouse, $quantity, 'sale', $sale, createdBy: $createdBy);

                $lineTotal = bcmul($quantity, (string) $priceTier->unit_price, 4);
                $subtotal = bcadd($subtotal, $lineTotal, 4);

                $sale->items()->create([
                    'product_id' => $product->id,
                    'quantity' => $quantity,
                    'input_quantity' => $quantity,
                    'input_unit_id' => $item['unit_id'] ?? $product->base_unit_id,
                    'price_tier_id' => $priceTier->id,
                    'unit_price' => $priceTier->unit_price,
                    'line_total' => $lineTotal,
                ]);
            }

            $sale->update(['subtotal' => $subtotal, 'total' => $subtotal]);

            $number = $this->nextSequenceNumberService->generate('sales_ticket', self::DEFAULT_TICKET_SERIES);

            FiscalDocument::query()->create([
                'sale_id' => $sale->id,
                'document_type' => 'sales_ticket',
                'series_code' => self::DEFAULT_TICKET_SERIES,
                'number' => $number,
                'status' => 'issued',
                'issued_at' => now(),
            ]);

            return $sale->fresh(['items', 'fiscalDocuments']);
        });
    }
}
