<?php

declare(strict_types=1);

namespace App\Exceptions;

final class PosCheckoutException extends DomainException
{
    public static function unsupportedPaymentMethod(string $method): self
    {
        return new self("El método de pago [{$method}] no está permitido.");
    }

    public static function cashReceivedRequired(): self
    {
        return new self('Ingresa el efectivo recibido para confirmar el cobro.');
    }

    public static function unexpectedReceivedAmount(string $method): self
    {
        return new self("El método de pago [{$method}] no acepta efectivo recibido.");
    }

    public static function emptyOrder(int $orderId): self
    {
        return new self("La orden [{$orderId}] está vacía y no se puede cobrar.");
    }

    public static function insufficientCash(string $receivedAmount, string $payableTotal): self
    {
        return new self(
            "El efectivo recibido [{$receivedAmount}] es menor que el total a cobrar [{$payableTotal}].",
        );
    }

    public static function invalidDefaultSeries(int $cashRegisterId): self
    {
        return new self(
            "La caja [{$cashRegisterId}] no tiene una serie activa de nota de venta asignada como predeterminada.",
        );
    }

    public static function invalidWarehouse(int $cashRegisterId): self
    {
        return new self("El almacén configurado para la caja [{$cashRegisterId}] no pertenece a su tienda.");
    }

    public static function incompleteExistingSale(int $saleId): self
    {
        return new self("La venta POS existente [{$saleId}] no tiene un pago o nota de venta completos.");
    }
}
