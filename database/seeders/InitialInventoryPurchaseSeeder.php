<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\DocumentSeries;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final class InitialInventoryPurchaseSeeder extends Seeder
{
    private const PURCHASE_NUMBER = 5;

    public function run(): void
    {
        DB::transaction(function (): void {
            $supplier = Supplier::query()->updateOrCreate(
                ['name' => 'Inventario inicial'],
                [
                    'document_number' => null,
                    'phone' => null,
                    'email' => null,
                    'is_active' => true,
                ],
            );
            $warehouse = Warehouse::query()->where('code', 'MAIN')->firstOrFail();
            $admin = User::query()->where('email', 'admin@mayoreo.test')->first();
            $lines = $this->resolvedLines();
            $total = '0.0000';

            foreach ($lines as $line) {
                /** @var numeric-string $total */
                $total = bcadd(
                    $total,
                    bcmul($line['quantity'], $line['unit_cost'], 4),
                    4,
                );
            }

            $order = PurchaseOrder::query()->firstOrNew([
                'series_code' => 'OC01',
                'number' => self::PURCHASE_NUMBER,
            ]);

            if ($order->exists && $order->status !== 'draft') {
                throw new RuntimeException('La compra de inventario inicial ya no está en borrador.');
            }

            $order->fill([
                'supplier_id' => $supplier->id,
                'warehouse_id' => $warehouse->id,
                'status' => 'draft',
                'ordered_at' => '2026-08-08',
                'invoice_series' => null,
                'invoice_number' => null,
                'total' => $total,
                'received_at' => null,
                'notes' => 'Carga de inventario inicial desde plantilla.xlsx. Incluye únicamente 30 productos con mapeo y costo histórico validados. Pendientes: 14 coincidencias sin costo y 40 filas con mapeo ambiguo.',
                'created_by' => $admin?->id,
            ]);
            $order->save();

            $order->items()->delete();

            foreach ($lines as $line) {
                $order->items()->create([
                    'product_id' => $line['product']->id,
                    'product_purchase_unit_id' => null,
                    'quantity_purchased' => $line['quantity'],
                    'quantity' => '0',
                    'unit_cost' => $line['unit_cost'],
                ]);
            }

            $series = DocumentSeries::query()
                ->where('document_type', 'purchase')
                ->where('series_code', 'OC01')
                ->firstOrFail();

            if ($series->current_number < self::PURCHASE_NUMBER) {
                $series->update(['current_number' => self::PURCHASE_NUMBER]);
            }
        });
    }

    /**
     * @return list<array{product: Product, quantity: numeric-string, unit_cost: numeric-string}>
     */
    private function resolvedLines(): array
    {
        return array_map(function (array $line): array {
            $product = Product::query()->where('sku', $line['sku'])->first();

            if (! $product instanceof Product) {
                throw new RuntimeException("No se encontró el producto [{$line['sku']}] para el inventario inicial.");
            }

            return [
                'product' => $product,
                'quantity' => $line['quantity'],
                'unit_cost' => $line['unit_cost'],
            ];
        }, $this->lines());
    }

    /**
     * Las cantidades ya están expresadas en la unidad base del producto.
     *
     * @return list<array{sku: non-empty-string, quantity: numeric-string, unit_cost: numeric-string}>
     */
    private function lines(): array
    {
        return [
            ['sku' => 'A055', 'quantity' => '850', 'unit_cost' => '3.2222'],
            ['sku' => 'A053', 'quantity' => '800', 'unit_cost' => '3.2000'],
            ['sku' => 'A074', 'quantity' => '395.6', 'unit_cost' => '4.5000'],
            ['sku' => 'A054', 'quantity' => '150', 'unit_cost' => '3.2444'],
            ['sku' => 'A119', 'quantity' => '500', 'unit_cost' => '4.7080'],
            ['sku' => 'A152', 'quantity' => '100', 'unit_cost' => '7.0000'],
            ['sku' => 'A151', 'quantity' => '100', 'unit_cost' => '11.0000'],
            ['sku' => 'A150', 'quantity' => '75', 'unit_cost' => '9.0000'],
            ['sku' => 'A155', 'quantity' => '30', 'unit_cost' => '15.0000'],
            ['sku' => 'A166', 'quantity' => '70', 'unit_cost' => '8.5000'],
            ['sku' => 'A163', 'quantity' => '66', 'unit_cost' => '23.0000'],
            ['sku' => 'A164', 'quantity' => '46', 'unit_cost' => '23.5000'],
            ['sku' => 'A124', 'quantity' => '20', 'unit_cost' => '18.0000'],
            ['sku' => 'A127', 'quantity' => '90', 'unit_cost' => '15.5000'],
            ['sku' => 'A130', 'quantity' => '11', 'unit_cost' => '95.0000'],
            ['sku' => 'A129', 'quantity' => '20', 'unit_cost' => '23.5000'],
            ['sku' => 'A115', 'quantity' => '250', 'unit_cost' => '12.5000'],
            ['sku' => 'A114', 'quantity' => '50', 'unit_cost' => '28.0000'],
            ['sku' => 'A105', 'quantity' => '150', 'unit_cost' => '7.5000'],
            ['sku' => 'A051', 'quantity' => '100', 'unit_cost' => '4.5000'],
            ['sku' => 'A049', 'quantity' => '825', 'unit_cost' => '3.9000'],
            ['sku' => 'A095', 'quantity' => '400', 'unit_cost' => '3.5000'],
            ['sku' => 'A041', 'quantity' => '100', 'unit_cost' => '4.6000'],
            ['sku' => 'A093', 'quantity' => '342', 'unit_cost' => '3.2000'],
            ['sku' => 'A099', 'quantity' => '100', 'unit_cost' => '3.8000'],
            ['sku' => 'A204', 'quantity' => '10', 'unit_cost' => '8.5000'],
            ['sku' => 'A092', 'quantity' => '100', 'unit_cost' => '6.5000'],
            ['sku' => 'A201', 'quantity' => '50', 'unit_cost' => '48.0000'],
            ['sku' => 'A094', 'quantity' => '50', 'unit_cost' => '5.8000'],
            ['sku' => 'A134', 'quantity' => '325', 'unit_cost' => '11.0000'],
        ];
    }
}
