<?php

declare(strict_types=1);

namespace App\Actions\Inventory;

use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\Warehouse;
use App\Services\StockLedgerService;

final readonly class AdjustStockAction
{
    public function __construct(
        private StockLedgerService $stockLedgerService,
    ) {}

    public function execute(
        Product $product,
        Warehouse $warehouse,
        string $direction,
        string $quantity,
        ?string $unitCost = null,
        ?string $notes = null,
        ?int $createdBy = null,
    ): InventoryMovement {
        if ($direction === 'increase') {
            return $this->stockLedgerService->registerIn(
                $product,
                $warehouse,
                $quantity,
                $unitCost ?? (string) $this->stockLedgerService->balance($product, $warehouse)->average_cost,
                'adjustment',
                notes: $notes,
                createdBy: $createdBy,
            );
        }

        return $this->stockLedgerService->registerOut(
            $product,
            $warehouse,
            $quantity,
            'adjustment',
            notes: $notes,
            createdBy: $createdBy,
        );
    }
}
