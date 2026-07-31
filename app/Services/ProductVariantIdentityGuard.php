<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Product;
use Illuminate\Validation\ValidationException;

final class ProductVariantIdentityGuard
{
    /**
     * @param  array<string, mixed>  $values
     */
    public function assertMeasurementIdentityCanChange(
        Product $product,
        array $values,
        string $fieldPrefix = '',
    ): void {
        if (! $product->exists || ! $product->hasOperationalHistory()) {
            return;
        }

        $fields = [
            'base_unit_id' => 'La unidad de medida',
            'sale_mode' => 'El modo de venta',
            'content_quantity' => 'El factor o contenido',
            'content_unit_id' => 'La unidad del contenido',
        ];

        foreach ($fields as $field => $label) {
            if (! array_key_exists($field, $values)) {
                continue;
            }

            $current = $product->getAttribute($field);
            $requested = $values[$field];
            $unchanged = $field === 'content_quantity'
                ? $this->sameDecimal($current, $requested)
                : $this->sameNullableScalar($current, $requested);

            if (! $unchanged) {
                throw ValidationException::withMessages([
                    $fieldPrefix.$field => "{$label} no puede cambiar porque la variante ya tiene movimientos o documentos.",
                ]);
            }
        }
    }

    /**
     * @param  list<int>  $requestedValueIds
     */
    public function assertAttributeCombinationCanChange(
        Product $product,
        array $requestedValueIds,
        string $field,
    ): void {
        if (! $product->exists || ! $product->hasOperationalHistory()) {
            return;
        }

        $currentValueIds = $product->attributeValues()
            ->pluck('product_attribute_values.id')
            ->map(static fn (mixed $id): int => is_numeric($id) ? (int) $id : 0)
            ->filter(static fn (int $id): bool => $id > 0)
            ->sort()
            ->values()
            ->all();
        sort($requestedValueIds);

        if ($currentValueIds !== $requestedValueIds) {
            throw ValidationException::withMessages([
                $field => 'La combinación de atributos no puede cambiar porque la variante ya tiene movimientos o documentos.',
            ]);
        }
    }

    private function sameDecimal(mixed $current, mixed $requested): bool
    {
        if ($current === null || $requested === null || $requested === '') {
            return $current === null && ($requested === null || $requested === '');
        }

        if (! is_numeric($current) || ! is_numeric($requested)) {
            return $current === $requested;
        }

        return bccomp(
            $this->numericString($current),
            $this->numericString($requested),
            6,
        ) === 0;
    }

    private function sameNullableScalar(mixed $current, mixed $requested): bool
    {
        $normalizedCurrent = $this->nullableScalarString($current);
        $normalizedRequested = $this->nullableScalarString($requested);

        return $normalizedCurrent === $normalizedRequested;
    }

    private function nullableScalarString(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return is_scalar($value) ? (string) $value : null;
    }

    /**
     * @param  int|float|numeric-string  $value
     * @return numeric-string
     */
    private function numericString(int|float|string $value): string
    {
        return (string) $value;
    }
}
