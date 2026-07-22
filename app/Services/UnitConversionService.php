<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\IncompatibleUnitException;
use App\Models\Product;
use App\Models\ProductPurchaseUnit;

/**
 * Pure conversion logic: turns a quantity expressed in a purchase
 * presentation (e.g. "10 sacos de 50kg") into the product's base unit
 * of measure (e.g. grams), with no side effects or persistence.
 */
final class UnitConversionService
{
    private const SCALE = 6;

    public function toBaseUnit(Product $product, string $quantity, ?ProductPurchaseUnit $purchaseUnit): string
    {
        if (! $purchaseUnit instanceof ProductPurchaseUnit) {
            return bcadd($quantity, '0', self::SCALE);
        }

        if ($purchaseUnit->product_id !== $product->id) {
            throw IncompatibleUnitException::purchaseUnitDoesNotBelongToProduct($purchaseUnit->id, $product->id);
        }

        return bcmul($quantity, (string) $purchaseUnit->conversion_factor, self::SCALE);
    }
}
