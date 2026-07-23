<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\IncompatibleUnitException;
use App\Models\Product;
use App\Models\ProductPurchaseUnit;
use App\Models\UnitOfMeasure;

/**
 * Pure conversion logic: turns a quantity expressed in a purchase
 * presentation (e.g. "10 sacos de 50kg") into the product's base unit
 * of measure (e.g. grams), with no side effects or persistence.
 */
final class UnitConversionService
{
    private const SCALE = 6;

    /** @var array<string, array<string, numeric-string>> */
    private const UNIT_FACTORS = [
        'weight' => [
            'g' => '1',
            'kg' => '1000',
        ],
        'volume' => [
            'ml' => '1',
            'l' => '1000',
        ],
        'count' => [
            'unit' => '1',
            'unidad' => '1',
            'un' => '1',
            'und' => '1',
        ],
    ];

    public function toBaseUnit(Product $product, string $quantity, ?ProductPurchaseUnit $purchaseUnit): string
    {
        /** @var numeric-string $normalizedQuantity */
        $normalizedQuantity = $quantity;

        if (! $purchaseUnit instanceof ProductPurchaseUnit) {
            return bcadd($normalizedQuantity, '0', self::SCALE);
        }

        if ($purchaseUnit->product_id !== $product->id) {
            throw IncompatibleUnitException::purchaseUnitDoesNotBelongToProduct($purchaseUnit->id, $product->id);
        }

        /** @var numeric-string $conversionFactor */
        $conversionFactor = (string) $purchaseUnit->conversion_factor;

        return bcmul($normalizedQuantity, $conversionFactor, self::SCALE);
    }

    /**
     * Converts a POS quantity expressed with a common entry unit into the
     * product's configured base unit. A missing code keeps the legacy API
     * contract, where quantity is already expressed in the base unit.
     *
     * @param  numeric-string  $quantity
     * @return numeric-string
     */
    public function toBaseUnitFromCode(Product $product, string $quantity, ?string $unitCode): string
    {
        if ($unitCode === null || $unitCode === '') {
            return bcadd($quantity, '0', self::SCALE);
        }

        $baseUnit = $product->baseUnit()->first();

        if (! $baseUnit instanceof UnitOfMeasure) {
            throw IncompatibleUnitException::unitCodeDoesNotMatchProductBaseUnit($unitCode, $product->id);
        }

        $normalizedInputCode = mb_strtolower(mb_trim($unitCode));
        $normalizedBaseCode = mb_strtolower(mb_trim($baseUnit->code));

        if ($normalizedInputCode === $normalizedBaseCode) {
            return bcadd($quantity, '0', self::SCALE);
        }

        $factors = self::UNIT_FACTORS[$baseUnit->type] ?? [];
        $inputFactor = $factors[$normalizedInputCode] ?? null;
        $baseFactor = $factors[$normalizedBaseCode] ?? null;

        if ($inputFactor === null || $baseFactor === null) {
            throw IncompatibleUnitException::unitCodeDoesNotMatchProductBaseUnit($unitCode, $product->id);
        }

        $quantityInCanonicalUnit = bcmul($quantity, $inputFactor, self::SCALE + 6);

        return bcdiv($quantityInCanonicalUnit, $baseFactor, self::SCALE);
    }
}
