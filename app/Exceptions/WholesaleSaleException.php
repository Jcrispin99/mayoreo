<?php

declare(strict_types=1);

namespace App\Exceptions;

final class WholesaleSaleException extends DomainException
{
    public static function inactiveWarehouse(int $warehouseId): self
    {
        return new self("El almacén [{$warehouseId}] está inactivo y no puede usarse para vender.");
    }

    public static function productUnavailable(int $productId): self
    {
        return new self("El producto [{$productId}] está inactivo o ya no está disponible.");
    }

    public static function invalidSeries(): self
    {
        return new self('Selecciona una serie activa de nota de venta.');
    }

    public static function cashSessionRequired(): self
    {
        return new self('Selecciona una sesión de caja abierta para registrar un pago en efectivo.');
    }

    public static function invalidCashSession(int $sessionId): self
    {
        return new self("La sesión de caja [{$sessionId}] no está abierta o no pertenece a la tienda del almacén.");
    }

    public static function unsupportedPaymentMethod(string $method): self
    {
        return new self("El método de pago [{$method}] no está permitido.");
    }

    public static function cashReceivedRequired(): self
    {
        return new self('Ingresa el efectivo recibido para completar la venta.');
    }

    public static function insufficientCash(string $received, string $total): self
    {
        return new self("El efectivo recibido [{$received}] es menor que el total [{$total}].");
    }

    public static function unexpectedReceivedAmount(string $method): self
    {
        return new self("El método de pago [{$method}] no acepta efectivo recibido.");
    }
}
