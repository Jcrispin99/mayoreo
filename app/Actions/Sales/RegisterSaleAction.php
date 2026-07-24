<?php

declare(strict_types=1);

namespace App\Actions\Sales;

use App\Models\Sale;
use App\Models\Warehouse;

final readonly class RegisterSaleAction
{
    public function __construct(
        private CompleteWholesaleSaleAction $completeWholesaleSaleAction,
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
        return $this->completeWholesaleSaleAction->execute([
            'warehouse_id' => $warehouse->id,
            'customer_name' => $customerName,
            'customer_document' => $customerDocument,
            'items' => array_values($items),
        ], $createdBy);
    }
}
