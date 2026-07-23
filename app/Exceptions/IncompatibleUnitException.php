<?php

declare(strict_types=1);

namespace App\Exceptions;

final class IncompatibleUnitException extends DomainException
{
    public static function purchaseUnitDoesNotBelongToProduct(int $purchaseUnitId, int $productId): self
    {
        return new self("Purchase unit [{$purchaseUnitId}] does not belong to product [{$productId}].");
    }

    public static function unitDoesNotMatchProductBaseUnit(int $unitId, int $productId): self
    {
        return new self("Unit [{$unitId}] does not match the base unit of product [{$productId}].");
    }

    public static function unitCodeDoesNotMatchProductBaseUnit(string $unitCode, int $productId): self
    {
        return new self("Unit code [{$unitCode}] does not match the base unit of product [{$productId}].");
    }
}
