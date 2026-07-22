<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Actions\Purchasing\RegisterPurchaseAction;
use App\Models\Product;
use App\Models\ProductPurchaseUnit;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\UnitOfMeasure;
use App\Models\Warehouse;
use Illuminate\Database\Seeder;

final class PurchaseOrderSeeder extends Seeder
{
    /**
     * Seed 2 confirmed purchase orders (with items) against the MAIN warehouse,
     * so stock/kardex data exists out of the box.
     */
    public function run(): void
    {
        $mainWarehouse = Warehouse::query()->where('code', 'MAIN')->first();

        if (! $mainWarehouse instanceof Warehouse) {
            return;
        }

        $supplierArroz = Supplier::query()->firstOrCreate(
            ['document_number' => '20100001111'],
            ['name' => 'Molinera del Norte SAC', 'phone' => '013456789', 'email' => 'ventas@molineranorte.pe', 'is_active' => true],
        );

        $supplierAceite = Supplier::query()->firstOrCreate(
            ['document_number' => '20100002222'],
            ['name' => 'Distribuidora Aceites del Sur', 'phone' => '014567890', 'email' => 'contacto@aceitessur.pe', 'is_active' => true],
        );

        $gramos = UnitOfMeasure::query()->firstOrCreate(['code' => 'g'], ['name' => 'Gramos', 'type' => 'weight']);
        $mililitros = UnitOfMeasure::query()->firstOrCreate(['code' => 'ml'], ['name' => 'Mililitros', 'type' => 'volume']);

        $arroz = Product::query()->firstOrCreate(
            ['sku' => 'ARROZ-EXTRA'],
            ['name' => 'Arroz extra a granel', 'base_unit_id' => $gramos->id, 'is_active' => true],
        );

        $aceite = Product::query()->firstOrCreate(
            ['sku' => 'ACEITE-VEGETAL'],
            ['name' => 'Aceite vegetal a granel', 'base_unit_id' => $mililitros->id, 'is_active' => true],
        );

        $sacoArroz = ProductPurchaseUnit::query()->firstOrCreate(
            ['product_id' => $arroz->id, 'name' => 'saco 50kg'],
            ['conversion_factor' => 50000, 'is_default_purchase' => true],
        );

        $bidonAceite = ProductPurchaseUnit::query()->firstOrCreate(
            ['product_id' => $aceite->id, 'name' => 'bidón 20L'],
            ['conversion_factor' => 20000, 'is_default_purchase' => true],
        );

        /** @var RegisterPurchaseAction $registerPurchaseAction */
        $registerPurchaseAction = app(RegisterPurchaseAction::class);

        $purchases = [
            [
                'supplier_id' => $supplierArroz->id,
                'invoice_number' => 'F001-00012345',
                'product_id' => $arroz->id,
                'product_purchase_unit_id' => $sacoArroz->id,
                'quantity_purchased' => 20, // 20 sacos de 50kg
                'unit_cost' => 95, // 95 soles por saco
            ],
            [
                'supplier_id' => $supplierAceite->id,
                'invoice_number' => 'F001-00012346',
                'product_id' => $aceite->id,
                'product_purchase_unit_id' => $bidonAceite->id,
                'quantity_purchased' => 15, // 15 bidones de 20L
                'unit_cost' => 180, // 180 soles por bidón
            ],
        ];

        foreach ($purchases as $purchase) {
            $existing = PurchaseOrder::query()
                ->where('invoice_number', $purchase['invoice_number'])
                ->first();

            if ($existing instanceof PurchaseOrder) {
                continue;
            }

            $order = PurchaseOrder::query()->create([
                'supplier_id' => $purchase['supplier_id'],
                'warehouse_id' => $mainWarehouse->id,
                'status' => 'draft',
                'ordered_at' => now()->toDateString(),
                'invoice_number' => $purchase['invoice_number'],
            ]);

            $order->items()->create([
                'product_id' => $purchase['product_id'],
                'product_purchase_unit_id' => $purchase['product_purchase_unit_id'],
                'quantity_purchased' => $purchase['quantity_purchased'],
                'quantity' => 0,
                'unit_cost' => $purchase['unit_cost'],
            ]);

            $registerPurchaseAction->execute($order);
        }
    }
}
