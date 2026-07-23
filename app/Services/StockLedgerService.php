<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\InsufficientStockException;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\Stock;
use App\Models\Warehouse;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Kardex (weighted average cost) ledger: every entrada/salida updates the
 * running balance (quantity, average unit cost, total cost) for a
 * product+warehouse, and records an immutable inventory_movements row
 * with the balance snapshot at that point in time.
 */
final class StockLedgerService
{
    private const QUANTITY_SCALE = 6;

    private const COST_SCALE = 4;

    /**
     * Register a stock entrada (purchase, transfer_in, or a positive adjustment).
     */
    public function registerIn(
        Product $product,
        Warehouse $warehouse,
        string $quantity,
        string $unitCost,
        string $type = 'purchase',
        ?Model $reference = null,
        ?string $notes = null,
        ?int $createdBy = null,
    ): InventoryMovement {
        return DB::transaction(function () use ($product, $warehouse, $quantity, $unitCost, $type, $reference, $notes, $createdBy): InventoryMovement {
            $stock = $this->lockStock($product, $warehouse);

            $incomingTotalCost = bcmul($quantity, $unitCost, self::COST_SCALE);
            $newQuantity = bcadd((string) $stock->quantity, $quantity, self::QUANTITY_SCALE);
            $newTotalCost = bcadd((string) $stock->total_cost, $incomingTotalCost, self::COST_SCALE);
            $newAverageCost = $this->averageCost($newQuantity, $newTotalCost);

            $stock->update([
                'quantity' => $newQuantity,
                'average_cost' => $newAverageCost,
                'total_cost' => $newTotalCost,
            ]);

            return InventoryMovement::query()->create([
                'product_id' => $product->id,
                'warehouse_id' => $warehouse->id,
                'type' => $type,
                'quantity' => $quantity,
                'direction' => $type === 'adjustment' ? 'increase' : null,
                'unit_cost' => $unitCost,
                'balance_quantity' => $newQuantity,
                'balance_unit_cost' => $newAverageCost,
                'balance_total_cost' => $newTotalCost,
                'reference_type' => $reference?->getMorphClass(),
                'reference_id' => $reference?->getKey(),
                'notes' => $notes,
                'created_by' => $createdBy,
            ]);
        });
    }

    /**
     * Register a stock salida (sale, transfer_out, or a negative adjustment).
     * The cost of the movement is always the current weighted average cost
     * (promedio ponderado) — exits never change the average, only the balance.
     */
    public function registerOut(
        Product $product,
        Warehouse $warehouse,
        string $quantity,
        string $type = 'sale',
        ?Model $reference = null,
        ?string $notes = null,
        ?int $createdBy = null,
    ): InventoryMovement {
        return DB::transaction(function () use ($product, $warehouse, $quantity, $type, $reference, $notes, $createdBy): InventoryMovement {
            $stock = $this->lockStock($product, $warehouse);

            if ($type !== 'sale' && bccomp($quantity, (string) $stock->quantity, self::QUANTITY_SCALE) > 0) {
                throw InsufficientStockException::forProductInWarehouse(
                    $product->id,
                    $warehouse->id,
                    (string) $stock->quantity,
                    $quantity,
                );
            }

            $unitCost = (string) $stock->average_cost;
            $newQuantity = bcsub((string) $stock->quantity, $quantity, self::QUANTITY_SCALE);
            $newTotalCost = bcmul($newQuantity, $unitCost, self::COST_SCALE);
            $newAverageCost = $this->averageCost($newQuantity, $newTotalCost);

            $stock->update([
                'quantity' => $newQuantity,
                'average_cost' => $newAverageCost,
                'total_cost' => $newTotalCost,
            ]);

            return InventoryMovement::query()->create([
                'product_id' => $product->id,
                'warehouse_id' => $warehouse->id,
                'type' => $type,
                'quantity' => $quantity,
                'direction' => $type === 'adjustment' ? 'decrease' : null,
                'unit_cost' => $unitCost,
                'balance_quantity' => $newQuantity,
                'balance_unit_cost' => $newAverageCost,
                'balance_total_cost' => $newTotalCost,
                'reference_type' => $reference?->getMorphClass(),
                'reference_id' => $reference?->getKey(),
                'notes' => $notes,
                'created_by' => $createdBy,
            ]);
        });
    }

    /**
     * Current Kardex balance (saldo) for a product in a warehouse.
     */
    public function balance(Product $product, Warehouse $warehouse): Stock
    {
        return Stock::query()->firstOrCreate(
            ['warehouse_id' => $warehouse->id, 'product_id' => $product->id],
            ['quantity' => 0, 'average_cost' => 0, 'total_cost' => 0],
        );
    }

    private function lockStock(Product $product, Warehouse $warehouse): Stock
    {
        $stock = Stock::query()
            ->where('warehouse_id', $warehouse->id)
            ->where('product_id', $product->id)
            ->lockForUpdate()
            ->first();

        if ($stock instanceof Stock) {
            return $stock;
        }

        return Stock::query()->create([
            'warehouse_id' => $warehouse->id,
            'product_id' => $product->id,
            'quantity' => 0,
            'average_cost' => 0,
            'total_cost' => 0,
        ]);
    }

    private function averageCost(string $quantity, string $totalCost): string
    {
        if (bccomp($quantity, '0', self::QUANTITY_SCALE) <= 0) {
            return '0.0000';
        }

        return bcdiv($totalCost, $quantity, self::COST_SCALE);
    }
}
