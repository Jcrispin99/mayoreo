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

    public static function invalidDocumentSeries(int $cashRegisterId): self
    {
        return new self(
            "Selecciona una serie activa de nota de venta, boleta o factura asignada a la caja [{$cashRegisterId}].",
        );
    }

    public static function invalidInvoiceCustomer(): self
    {
        return new self('Para emitir una factura selecciona un cliente con razón social y RUC de 11 dígitos.');
    }

    public static function invalidReceiptCustomer(): self
    {
        return new self('Para emitir una boleta usa un cliente sin documento, con DNI de 8 dígitos o RUC de 11 dígitos.');
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
