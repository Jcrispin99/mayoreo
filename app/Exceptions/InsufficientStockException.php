<?php

declare(strict_types=1);

namespace App\Exceptions;

final class InsufficientStockException extends DomainException
{
    public static function forProductInWarehouse(int $productId, int $warehouseId, string $available, string $requested): self
    {
        return new self(
            "Insufficient stock for product [{$productId}] in warehouse [{$warehouseId}]: ".
            "available [{$available}], requested [{$requested}]."
        );
    }
}
