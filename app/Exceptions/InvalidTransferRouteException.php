<?php

declare(strict_types=1);

namespace App\Exceptions;

final class InvalidTransferRouteException extends DomainException
{
    public static function forWarehouses(int $fromWarehouseId, int $toWarehouseId): self
    {
        return new self("Transfers from warehouse [{$fromWarehouseId}] to warehouse [{$toWarehouseId}] are not allowed.");
    }

    public static function sameWarehouse(int $warehouseId): self
    {
        return new self("Cannot transfer stock from warehouse [{$warehouseId}] to itself.");
    }

    public static function forStatus(string $expected, string $actual): self
    {
        return new self("Expected transfer status [{$expected}], got [{$actual}].");
    }
}
