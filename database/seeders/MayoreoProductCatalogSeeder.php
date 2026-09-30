<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Product;
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
     * @return array{kg: UnitOfMeasure, unidad: UnitOfMeasure}
     */
    private function units(): array
    {
        return [
            'kg' => UnitOfMeasure::query()->updateOrCreate(
                ['code' => 'kg'],
                ['name' => 'Kilogramos', 'type' => 'weight'],
            ),
            'unidad' => UnitOfMeasure::query()->updateOrCreate(
                ['code' => 'NIU'],
                ['name' => 'Unidad', 'type' => 'count'],
            ),
        ];
    }

    /**
     * @param  array<string, mixed>  $item
     * @param  array{kg: UnitOfMeasure, unidad: UnitOfMeasure}  $units
     */
    private function seedProduct(array $item, array $units): void
    {
        $sku = $this->requiredString($item, 'sku');
        $name = $this->requiredString($item, 'name');
        $unitCode = $this->catalogUnit($item['unit'] ?? null);
        $quantity = $this->nullableNumericString($item['quantity'] ?? null);

        $product = Product::withTrashed()->where('sku', $sku)->first();
        $template = $product instanceof Product && $product->product_template_id !== null
            ? ProductTemplate::withTrashed()->find($product->product_template_id)
            : null;

        if (! $template instanceof ProductTemplate) {
            $template = ProductTemplate::withTrashed()->where('name', $name)->first()
                ?? new ProductTemplate();
        }

        $isNewTemplate = ! $template->exists;
        $template->fill([
            'name' => $name,
            'description' => $this->description($item, $quantity, $unitCode),
            'is_active' => true,
        ]);
        if ($isNewTemplate) {
            // Se siembra sin precios: no puede venderse en el POS hasta configurarlos.
            $template->is_pos_visible = false;
        }
        $template->save();
        if ($template->trashed()) {
            $template->restore();
        }
        $template->attributeValues()->sync([]);

        $product ??= new Product();
        $saleMode = $unitCode === 'unidad' ? 'unit' : 'measured';
        [$contentQuantity, $contentUnitId] = $this->content($item, $units);
        $variantName = $saleMode === 'measured' ? 'Kilogramos' : 'Unidad';

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
    }

    /**
     * @param  array<string, mixed>  $item
     * @param  array{kg: UnitOfMeasure, unidad: UnitOfMeasure}  $units
     * @return array{0: numeric-string|null, 1: int|null}
     */
    private function content(array $item, array $units): array
    {
        $quantity = $this->nullableNumericString($item['content_quantity'] ?? null);
        $unit = $this->optionalString($item['content_unit'] ?? null);

        if ($quantity === null || $unit !== 'kg') {
            return [null, null];
        }

        return [$quantity, $units[$unit]->id];
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

        return $unit === 'kg' ? 'kg' : 'unidad';
    }

    /** @param numeric-string $quantity */
    private function quantityLabel(string $quantity): string
    {
        return mb_rtrim(mb_rtrim(number_format((float) $quantity, 6, '.', ''), '0'), '.');
    }
}
