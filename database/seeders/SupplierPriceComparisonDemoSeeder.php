<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Product;
use App\Models\ProductPurchaseUnit;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\SupplierProductPrice;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final class SupplierPriceComparisonDemoSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            $admin = User::query()->where('email', 'admin@mayoreo.test')->first();
            $suppliers = $this->seedSuppliers();

            $demoOrders = PurchaseOrder::query()->where('series_code', 'COT-DEMO')->get();
            foreach ($demoOrders as $demoOrder) {
                $demoOrder->items()->delete();
                $demoOrder->delete();
            }

            foreach ($this->quotes() as $quote) {
                $lines = $this->resolveLines($quote['lines']);

                foreach ($lines as $line) {
                    SupplierProductPrice::query()->updateOrCreate([
                        'supplier_id' => $suppliers[$quote['supplier']]->id,
                        'product_id' => $line['product']->id,
                    ], [
                        'product_purchase_unit_id' => $line['purchase_unit']->id,
                        'unit_cost' => $line['unit_cost'],
                        'quoted_at' => today()->subDays($quote['days_ago'])->toDateString(),
                        'notes' => "Precio demo ({$quote['label']}).",
                        'updated_by' => $admin?->id,
                    ]);
                }
            }
        });
    }

    /** @return array<string, Supplier> */
    private function seedSuppliers(): array
    {
        $definitions = [
            'andina' => [
                'name' => 'Distribuidora Andina (Demo)',
                'document_number' => '20900000001',
                'phone' => '900 000 101',
                'email' => 'ventas.andina@example.test',
            ],
            'santa_rosa' => [
                'name' => 'Comercial Santa Rosa (Demo)',
                'document_number' => '20900000002',
                'phone' => '900 000 102',
                'email' => 'cotizaciones.santarosa@example.test',
            ],
            'norte' => [
                'name' => 'Mayorista del Norte (Demo)',
                'document_number' => '20900000003',
                'phone' => '900 000 103',
                'email' => 'pedidos.norte@example.test',
            ],
        ];
        $suppliers = [];

        foreach ($definitions as $key => $definition) {
            $suppliers[$key] = Supplier::query()->updateOrCreate(
                ['document_number' => $definition['document_number']],
                [...$definition, 'is_active' => true],
            );
        }

        return $suppliers;
    }

    /**
     * @param  list<array{sku: non-empty-string, unit: 'base'|'package', quantity: numeric-string, unit_cost: numeric-string}>  $lines
     * @return list<array{product: Product, purchase_unit: ProductPurchaseUnit, quantity: numeric-string, unit_cost: numeric-string}>
     */
    private function resolveLines(array $lines): array
    {
        return array_map(function (array $line): array {
            $product = Product::query()->where('sku', $line['sku'])->first();

            if (! $product instanceof Product) {
                throw new RuntimeException("No se encontró el producto [{$line['sku']}] para las cotizaciones demo.");
            }

            $purchaseUnitQuery = $product->purchaseUnits();
            $purchaseUnit = $line['unit'] === 'package'
                ? $purchaseUnitQuery->where('conversion_factor', '>', 1)->orderByDesc('is_default_purchase')->first()
                : $purchaseUnitQuery->where('conversion_factor', 1)->first();

            if (! $purchaseUnit instanceof ProductPurchaseUnit) {
                throw new RuntimeException(
                    "No se encontró la presentación [{$line['unit']}] para el producto [{$line['sku']}].",
                );
            }

            return [
                'product' => $product,
                'purchase_unit' => $purchaseUnit,
                'quantity' => $line['quantity'],
                'unit_cost' => $line['unit_cost'],
            ];
        }, $lines);
    }

    /**
     * @return list<array{
     *     number: int,
     *     supplier: 'andina'|'santa_rosa'|'norte',
     *     label: non-empty-string,
     *     days_ago: int,
     *     lines: list<array{sku: non-empty-string, unit: 'base'|'package', quantity: numeric-string, unit_cost: numeric-string}>
     * }>
     */
    private function quotes(): array
    {
        return [
            [
                'number' => 1,
                'supplier' => 'andina',
                'label' => 'Andina anterior',
                'days_ago' => 10,
                'lines' => [
                    ['sku' => 'A001', 'unit' => 'package', 'quantity' => '2', 'unit_cost' => '240.0000'],
                    ['sku' => 'A041', 'unit' => 'package', 'quantity' => '2', 'unit_cost' => '128.0000'],
                    ['sku' => 'A055', 'unit' => 'package', 'quantity' => '1', 'unit_cost' => '211.5000'],
                ],
            ],
            [
                'number' => 2,
                'supplier' => 'santa_rosa',
                'label' => 'Santa Rosa vigente',
                'days_ago' => 1,
                'lines' => [
                    ['sku' => 'A001', 'unit' => 'base', 'quantity' => '100', 'unit_cost' => '4.6000'],
                    ['sku' => 'A041', 'unit' => 'package', 'quantity' => '4', 'unit_cost' => '119.5000'],
                    ['sku' => 'A055', 'unit' => 'package', 'quantity' => '2', 'unit_cost' => '198.0000'],
                    ['sku' => 'A105', 'unit' => 'package', 'quantity' => '1', 'unit_cost' => '420.0000'],
                ],
            ],
            [
                'number' => 3,
                'supplier' => 'norte',
                'label' => 'Norte vigente',
                'days_ago' => 2,
                'lines' => [
                    ['sku' => 'A001', 'unit' => 'package', 'quantity' => '2', 'unit_cost' => '220.0000'],
                    ['sku' => 'A041', 'unit' => 'base', 'quantity' => '50', 'unit_cost' => '5.0500'],
                    ['sku' => 'A049', 'unit' => 'package', 'quantity' => '2', 'unit_cost' => '121.2500'],
                    ['sku' => 'A092', 'unit' => 'package', 'quantity' => '1', 'unit_cost' => '365.0000'],
                    ['sku' => 'A105', 'unit' => 'base', 'quantity' => '50', 'unit_cost' => '8.2000'],
                ],
            ],
            [
                'number' => 4,
                'supplier' => 'andina',
                'label' => 'Andina vigente',
                'days_ago' => 0,
                'lines' => [
                    ['sku' => 'A001', 'unit' => 'package', 'quantity' => '2', 'unit_cost' => '225.0000'],
                    ['sku' => 'A049', 'unit' => 'package', 'quantity' => '2', 'unit_cost' => '118.7500'],
                    ['sku' => 'A092', 'unit' => 'base', 'quantity' => '25', 'unit_cost' => '7.5500'],
                ],
            ],
        ];
    }
}
