<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\PriceTier;
use App\Models\Product;
use App\Models\ProductPurchaseUnit;
use App\Models\ProductTemplate;
use App\Models\UnitOfMeasure;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use JsonException;
use RuntimeException;

final class MayoreoProductCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $units = $this->units();

        DB::transaction(function () use ($units): void {
            foreach ($this->catalog() as $item) {
                $this->seedProduct($item, $units);
            }
        });
    }

    /**
     * @return array{kg: UnitOfMeasure, L: UnitOfMeasure, unidad: UnitOfMeasure}
     */
    private function units(): array
    {
        return [
            'kg' => UnitOfMeasure::query()->updateOrCreate(
                ['code' => 'kg'],
                ['name' => 'Kilogramos', 'type' => 'weight'],
            ),
            'L' => UnitOfMeasure::query()->updateOrCreate(
                ['code' => 'L'],
                ['name' => 'Litros', 'type' => 'volume'],
            ),
            'unidad' => UnitOfMeasure::query()->updateOrCreate(
                ['code' => 'NIU'],
                ['name' => 'Unidad SUNAT', 'type' => 'count'],
            ),
        ];
    }

    /**
     * @param  array<string, mixed>  $item
     * @param  array{kg: UnitOfMeasure, L: UnitOfMeasure, unidad: UnitOfMeasure}  $units
     */
    private function seedProduct(array $item, array $units): void
    {
        $sku = $this->requiredString($item, 'sku');
        $name = $this->requiredString($item, 'name');
        $unitCode = $this->catalogUnit($item['unit'] ?? null);
        $quantity = $this->nullableNumericString($item['quantity'] ?? null);
        $confidence = $this->optionalString($item['confidence'] ?? null) ?? 'BAJA';
        $reviewStatus = $this->optionalString($item['review_status'] ?? null) ?? 'PENDIENTE';
        $prices = $this->prices($item['prices'] ?? null);
        $tiers = $this->priceTiersFor($unitCode, $quantity, $prices);

        $product = Product::withTrashed()->where('sku', $sku)->first();
        $template = $product instanceof Product && $product->product_template_id !== null
            ? ProductTemplate::withTrashed()->find($product->product_template_id)
            : null;

        if (! $template instanceof ProductTemplate) {
            $template = ProductTemplate::withTrashed()->where('name', $name)->first()
                ?? new ProductTemplate();
        }

        $template->fill([
            'name' => $name,
            'description' => $this->description($item, $quantity, $unitCode),
            'is_active' => true,
            'is_pos_visible' => $tiers !== [] && ($confidence !== 'BAJA' || $reviewStatus === 'APROBADO'),
        ]);
        $template->save();
        if ($template->trashed()) {
            $template->restore();
        }
        $template->attributeValues()->sync([]);

        $product ??= new Product();
        $saleMode = $unitCode === 'unidad' ? 'unit' : 'measured';
        [$contentQuantity, $contentUnitId] = $this->content($item, $units);
        $variantName = $saleMode === 'measured' ? 'Granel' : 'Unidad';

        $product->fill([
            'product_template_id' => $template->id,
            'sku' => $sku,
            'name' => "{$name} - {$variantName}",
            'variant_name' => $variantName,
            'description' => $template->description,
            'base_unit_id' => $units[$unitCode]->id,
            'sale_mode' => $saleMode,
            'content_quantity' => $saleMode === 'unit' ? $contentQuantity : null,
            'content_unit_id' => $saleMode === 'unit' ? $contentUnitId : null,
            'is_active' => true,
            'is_favorite' => false,
            'is_principal' => true,
        ]);
        $product->save();
        if ($product->trashed()) {
            $product->restore();
        }
        $product->attributeValues()->sync([]);

        $this->syncPriceTiers($product, $tiers);
        $this->syncPurchaseUnits($product, $unitCode, $quantity);
    }

    /**
     * @param  array<string, mixed>  $item
     * @param  array{kg: UnitOfMeasure, L: UnitOfMeasure, unidad: UnitOfMeasure}  $units
     * @return array{0: numeric-string|null, 1: int|null}
     */
    private function content(array $item, array $units): array
    {
        $quantity = $this->nullableNumericString($item['content_quantity'] ?? null);
        $unit = $this->optionalString($item['content_unit'] ?? null);

        if ($quantity === null || ! in_array($unit, ['kg', 'L'], true)) {
            return [null, null];
        }

        return [$quantity, $units[$unit]->id];
    }

    /**
     * @return array{retail: numeric-string|null, regular: numeric-string|null, package_total: numeric-string|null, wholesale: numeric-string|null}
     */
    private function prices(mixed $value): array
    {
        $prices = is_array($value) ? $value : [];

        return [
            'retail' => $this->nullableNumericString($prices['retail'] ?? null),
            'regular' => $this->nullableNumericString($prices['regular'] ?? null),
            'package_total' => $this->nullableNumericString($prices['package_total'] ?? null),
            'wholesale' => $this->nullableNumericString($prices['wholesale'] ?? null),
        ];
    }

    /**
     * @param  numeric-string|null  $quantity
     * @param  array{retail: numeric-string|null, regular: numeric-string|null, package_total: numeric-string|null, wholesale: numeric-string|null}  $prices
     * @return list<array{label: string, min: numeric-string, max: numeric-string|null, price: numeric-string}>
     */
    private function priceTiersFor(string $unit, ?string $quantity, array $prices): array
    {
        if ($unit === 'unidad') {
            return $this->unitPriceTiers($quantity, $prices);
        }

        $tiers = [];
        $retailPrice = $prices['retail'];
        $regularPrice = $this->roundToCents($prices['regular']);
        $wholesalePrice = $prices['wholesale'];
        $hasWholesale = $wholesalePrice !== null && $quantity !== null;

        if ($retailPrice !== null) {
            $tiers[] = [
                'label' => 'Menudeo',
                'min' => '0.001000',
                'max' => '0.999999',
                'price' => $retailPrice,
            ];
        }

        if ($regularPrice !== null && (! $hasWholesale || bccomp($quantity, '1', 6) > 0)) {
            $tiers[] = [
                'label' => $unit === 'kg' ? 'Por kilo' : 'Por litro',
                'min' => '1.000000',
                'max' => $hasWholesale ? bcsub($quantity, '0.000001', 6) : null,
                'price' => $regularPrice,
            ];
        }

        if ($hasWholesale) {
            $tiers[] = [
                'label' => $this->wholesaleLabel($unit, $quantity, $prices['package_total']),
                'min' => bccomp($quantity, '1', 6) >= 0 ? $quantity : '1.000000',
                'max' => null,
                'price' => $wholesalePrice,
            ];
        }

        return $tiers;
    }

    /**
     * @param  numeric-string|null  $quantity
     * @param  array{retail: numeric-string|null, regular: numeric-string|null, package_total: numeric-string|null, wholesale: numeric-string|null}  $prices
     * @return list<array{label: string, min: numeric-string, max: numeric-string|null, price: numeric-string}>
     */
    private function unitPriceTiers(?string $quantity, array $prices): array
    {
        $tiers = [];
        $retailPrice = $prices['retail'];
        $regularPrice = $this->roundToCents($prices['regular']);
        $wholesalePrice = $prices['wholesale'];
        $wholesaleThreshold = $quantity !== null && bccomp($quantity, '1', 6) > 0
            ? $quantity
            : null;

        if ($retailPrice !== null) {
            $tiers[] = [
                'label' => 'Menudeo',
                'min' => '1.000000',
                'max' => $regularPrice !== null || $wholesaleThreshold !== null ? '1.000000' : null,
                'price' => $retailPrice,
            ];
        }

        if ($regularPrice !== null && ($wholesaleThreshold === null || bccomp($wholesaleThreshold, '2', 6) > 0)) {
            $minimum = $retailPrice !== null ? '2.000000' : '1.000000';
            $tiers[] = [
                'label' => 'Venta unitaria',
                'min' => $minimum,
                'max' => $wholesaleThreshold !== null ? bcsub($wholesaleThreshold, '1', 6) : null,
                'price' => $regularPrice,
            ];
        }

        if ($wholesalePrice !== null && $wholesaleThreshold !== null) {
            $tiers[] = [
                'label' => $this->wholesaleLabel('unidad', $wholesaleThreshold, $prices['package_total']),
                'min' => $wholesaleThreshold,
                'max' => null,
                'price' => $wholesalePrice,
            ];
        }

        return $tiers;
    }

    /**
     * @param  numeric-string  $quantity
     * @param  numeric-string|null  $packageTotal
     */
    private function wholesaleLabel(string $unit, string $quantity, ?string $packageTotal): string
    {
        $label = match ($unit) {
            'kg' => "Cliente / saco {$this->quantityLabel($quantity)} kg",
            'L' => "Cliente / contenedor {$this->quantityLabel($quantity)} L",
            default => "Cliente / paquete x {$this->quantityLabel($quantity)}",
        };

        return $packageTotal === null ? $label : "{$label} (total S/ {$this->moneyLabel($packageTotal)})";
    }

    /**
     * @param  numeric-string|null  $price
     * @return numeric-string|null
     */
    private function roundToCents(?string $price): ?string
    {
        if ($price === null) {
            return null;
        }

        /** @var numeric-string $rounded */
        $rounded = bcadd($price, '0.005', 2);

        return $rounded;
    }

    /**
     * @param  list<array{label: string, min: numeric-string, max: numeric-string|null, price: numeric-string}>  $tiers
     */
    private function syncPriceTiers(Product $product, array $tiers): void
    {
        $product->priceTiers()->update(['is_active' => false]);

        foreach ($tiers as $tier) {
            PriceTier::query()->updateOrCreate(
                ['product_id' => $product->id, 'label' => $tier['label']],
                [
                    'min_quantity' => $tier['min'],
                    'max_quantity' => $tier['max'],
                    'unit_price' => $tier['price'],
                    'is_active' => true,
                ],
            );
        }
    }

    /** @param numeric-string|null $quantity */
    private function syncPurchaseUnits(Product $product, string $unit, ?string $quantity): void
    {
        $definitions = match ($unit) {
            'kg' => $this->measuredPurchaseUnits('Kilogramo', 'Saco', 'kg', $quantity),
            'L' => $this->measuredPurchaseUnits('Litro', 'Contenedor', 'L', $quantity),
            default => $this->countPurchaseUnits($quantity),
        };
        $processedIds = [];

        foreach ($definitions as $definition) {
            $purchaseUnit = ProductPurchaseUnit::query()->updateOrCreate(
                ['product_id' => $product->id, 'name' => $definition['name']],
                [
                    'conversion_factor' => $definition['factor'],
                    'barcode' => null,
                    'is_default_purchase' => $definition['default'],
                ],
            );
            $processedIds[] = $purchaseUnit->id;
        }

        $product->purchaseUnits()
            ->whereNotIn('id', $processedIds)
            ->update(['is_default_purchase' => false]);
    }

    /**
     * @param  numeric-string|null  $quantity
     * @return list<array{name: string, factor: numeric-string, default: bool}>
     */
    private function measuredPurchaseUnits(string $baseName, string $packageName, string $suffix, ?string $quantity): array
    {
        if ($quantity === null || bccomp($quantity, '1', 6) <= 0) {
            return [['name' => $baseName, 'factor' => '1.000000', 'default' => true]];
        }

        return [
            ['name' => $baseName, 'factor' => '1.000000', 'default' => false],
            [
                'name' => "{$packageName} {$this->quantityLabel($quantity)} {$suffix}",
                'factor' => $quantity,
                'default' => true,
            ],
        ];
    }

    /**
     * @param  numeric-string|null  $quantity
     * @return list<array{name: string, factor: numeric-string, default: bool}>
     */
    private function countPurchaseUnits(?string $quantity): array
    {
        if ($quantity === null || bccomp($quantity, '1', 6) <= 0) {
            return [['name' => 'Unidad', 'factor' => '1.000000', 'default' => true]];
        }

        return [
            ['name' => 'Unidad', 'factor' => '1.000000', 'default' => false],
            [
                'name' => "Paquete x {$this->quantityLabel($quantity)}",
                'factor' => $quantity,
                'default' => true,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $item
     * @param  numeric-string|null  $quantity
     */
    private function description(array $item, ?string $quantity, string $unit): string
    {
        $parts = ['Producto importado del catálogo de sistematización.'];

        if ($quantity !== null) {
            $parts[] = "Cantidad total referencial: {$this->quantityLabel($quantity)} {$unit}.";
        }

        $retailText = $this->optionalString($item['retail_text'] ?? null);
        if ($retailText !== null) {
            $parts[] = "Precio de menudeo pendiente de confirmar: {$retailText}.";
        }

        $sourceNote = $this->optionalString($item['source_note'] ?? null);
        if ($sourceNote !== null) {
            $parts[] = "Nota original: {$sourceNote}.";
        }

        return implode(' ', $parts);
    }

    /** @return list<array<string, mixed>> */
    private function catalog(): array
    {
        $path = database_path('seeders/data/mayoreo-product-catalog.json');
        $contents = file_get_contents($path);

        if ($contents === false) {
            throw new RuntimeException("No se pudo leer el catálogo [{$path}].");
        }

        try {
            $decoded = json_decode($contents, true, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new RuntimeException('El catálogo de productos contiene JSON inválido.', previous: $exception);
        }

        if (! is_array($decoded)) {
            throw new RuntimeException('El catálogo de productos debe contener una lista.');
        }

        /** @var list<array<string, mixed>> $decoded */
        return $decoded;
    }

    /** @param array<string, mixed> $item */
    private function requiredString(array $item, string $key): string
    {
        $value = $this->optionalString($item[$key] ?? null);

        if ($value === null) {
            throw new RuntimeException("El producto no contiene el campo obligatorio [{$key}].");
        }

        return $value;
    }

    private function optionalString(mixed $value): ?string
    {
        if (! is_string($value) && ! is_numeric($value)) {
            return null;
        }

        $normalized = mb_trim((string) $value);

        return $normalized === '' ? null : $normalized;
    }

    /** @return numeric-string|null */
    private function nullableNumericString(mixed $value): ?string
    {
        $normalized = $this->optionalString($value);

        if ($normalized === null || ! is_numeric($normalized) || bccomp($normalized, '0', 6) <= 0) {
            return null;
        }

        /** @var numeric-string $normalized */
        return $normalized;
    }

    private function catalogUnit(mixed $value): string
    {
        $unit = $this->optionalString($value);

        return in_array($unit, ['kg', 'L', 'unidad'], true) ? $unit : 'unidad';
    }

    /** @param numeric-string $quantity */
    private function quantityLabel(string $quantity): string
    {
        return mb_rtrim(mb_rtrim(number_format((float) $quantity, 6, '.', ''), '0'), '.');
    }

    /** @param numeric-string $amount */
    private function moneyLabel(string $amount): string
    {
        return number_format((float) $amount, 2, '.', '');
    }
}
