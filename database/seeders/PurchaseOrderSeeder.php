<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Actions\Purchasing\RegisterPurchaseAction;
use App\Models\DocumentSeries;
use App\Models\Product;
use App\Models\ProductPurchaseUnit;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\StockLedgerService;
use Illuminate\Database\Seeder;
use RuntimeException;

final class PurchaseOrderSeeder extends Seeder
{
    public function run(): void
    {
        $mainWarehouse = Warehouse::query()->where('code', 'MAIN')->firstOrFail();
        $posWarehouse = Warehouse::query()->where('code', 'POS')->firstOrFail();
        $admin = User::query()->where('email', 'admin@mayoreo.test')->first();

        $grainSupplier = $this->supplier(
            '20100001111',
            'Molinera Demo SAC',
            'ventas@molinerademo.test',
        );
        $oilSupplier = $this->supplier(
            '20100002222',
            'Distribuidora de Aceites Demo SAC',
            'ventas@aceitesdemo.test',
        );
        $beverageSupplier = $this->supplier(
            '20100003333',
            'Bebidas Demo SAC',
            'ventas@bebidasdemo.test',
        );

        $rice = $this->product('ARROZ-EXTRA-GRANEL');
        $oil = $this->product('ACEITE-VEGETAL-GRANEL');
        $sugar = $this->product('AZUCAR-RUBIA-GRANEL');
        $soda = $this->product('GASEOSA-COLA-500ML');

        $this->confirmedPurchase(
            1,
            $grainSupplier,
            $mainWarehouse,
            'F001',
            '00001001',
            [
                [$rice, $this->purchaseUnit($rice, 'Saco 50 kg'), '10', '160.0000'],
                [$rice, $this->purchaseUnit($rice, 'Kilogramo'), '100', '3.2000'],
            ],
            $admin?->id,
        );
        $this->confirmedPurchase(
            2,
            $oilSupplier,
            $mainWarehouse,
            'F001',
            '00001002',
            [
                [$oil, $this->purchaseUnit($oil, 'Bidón 20 L'), '8', '150.0000'],
                [$oil, $this->purchaseUnit($oil, 'Litro'), '50', '7.5000'],
            ],
            $admin?->id,
        );
        $this->confirmedPurchase(
            3,
            $grainSupplier,
            $mainWarehouse,
            'F001',
            '00001003',
            [
                [$sugar, $this->purchaseUnit($sugar, 'Saco 50 kg'), '6', '150.0000'],
                [$sugar, $this->purchaseUnit($sugar, 'Kilogramo'), '50', '3.0000'],
            ],
            $admin?->id,
        );
        $this->confirmedPurchase(
            4,
            $beverageSupplier,
            $mainWarehouse,
            'F001',
            '00001004',
            [
                [$soda, $this->purchaseUnit($soda, 'Caja x 24'), '10', '48.0000'],
            ],
            $admin?->id,
        );

        DocumentSeries::query()
            ->where('document_type', 'purchase')
            ->where('series_code', 'OC01')
            ->update(['current_number' => 4]);

        $this->moveInitialStock($rice, $mainWarehouse, $posWarehouse, '100000');
        $this->moveInitialStock($oil, $mainWarehouse, $posWarehouse, '40000');
        $this->moveInitialStock($sugar, $mainWarehouse, $posWarehouse, '50000');
        $this->moveInitialStock($soda, $mainWarehouse, $posWarehouse, '72');
    }

    private function supplier(string $document, string $name, string $email): Supplier
    {
        return Supplier::query()->updateOrCreate(
            ['document_number' => $document],
            [
                'name' => $name,
                'phone' => '999999999',
                'email' => $email,
                'is_active' => true,
            ],
        );
    }

    private function product(string $sku): Product
    {
        $product = Product::query()->where('sku', $sku)->first();

        if (! $product instanceof Product) {
            throw new RuntimeException("No se encontró el producto demo [{$sku}].");
        }

        return $product;
    }

    private function purchaseUnit(Product $product, string $name): ProductPurchaseUnit
    {
        $purchaseUnit = $product->purchaseUnits()->where('name', $name)->first();

        if (! $purchaseUnit instanceof ProductPurchaseUnit) {
            throw new RuntimeException("No se encontró la presentación de compra [{$name}].");
        }

        return $purchaseUnit;
    }

    /**
     * @param  list<array{Product, ProductPurchaseUnit, numeric-string, numeric-string}>  $lines
     */
    private function confirmedPurchase(
        int $number,
        Supplier $supplier,
        Warehouse $warehouse,
        string $invoiceSeries,
        string $invoiceNumber,
        array $lines,
        ?int $adminId,
    ): void {
        $total = '0.0000';

        foreach ($lines as [, , $quantity, $unitCost]) {
            /** @var numeric-string $total */
            $total = bcadd($total, bcmul($quantity, $unitCost, 4), 4);
        }

        $order = PurchaseOrder::query()->create([
            'series_code' => 'OC01',
            'number' => $number,
            'supplier_id' => $supplier->id,
            'warehouse_id' => $warehouse->id,
            'status' => 'draft',
            'ordered_at' => now()->subDays(7 - $number)->toDateString(),
            'invoice_series' => $invoiceSeries,
            'invoice_number' => $invoiceNumber,
            'total' => $total,
            'notes' => 'Compra demo confirmada automáticamente.',
            'created_by' => $adminId,
        ]);

        foreach ($lines as [$product, $purchaseUnit, $quantity, $unitCost]) {
            $order->items()->create([
                'product_id' => $product->id,
                'product_purchase_unit_id' => $purchaseUnit->id,
                'quantity_purchased' => $quantity,
                'quantity' => '0',
                'unit_cost' => $unitCost,
            ]);
        }

        app(RegisterPurchaseAction::class)->execute($order, $adminId);
    }

    private function moveInitialStock(
        Product $product,
        Warehouse $origin,
        Warehouse $destination,
        string $quantity,
    ): void {
        $ledger = app(StockLedgerService::class);
        $sourceStock = $ledger->balance($product, $origin);
        /** @var numeric-string $averageCost */
        $averageCost = (string) $sourceStock->average_cost;

        $ledger->registerOut(
            $product,
            $origin,
            $quantity,
            'transfer_out',
            notes: 'Abastecimiento inicial del POS.',
        );
        $ledger->registerIn(
            $product,
            $destination,
            $quantity,
            $averageCost,
            'transfer_in',
            notes: 'Stock inicial para pruebas POS.',
        );
    }
}
