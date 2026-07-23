<?php

declare(strict_types=1);

namespace App\Exceptions;

final class PosOrderException extends DomainException
{
    public static function doesNotBelongToSession(): self
    {
        return new self('La orden no pertenece a esta apertura de caja.');
    }

    public static function itemDoesNotBelongToOrder(): self
    {
        return new self('La línea no pertenece a esta orden.');
    }

    public static function notOpen(int $orderId): self
    {
        return new self("La orden [{$orderId}] ya no está abierta.");
    }

    public static function productUnavailable(int $productId): self
    {
        return new self("El producto [{$productId}] no está disponible para la tienda de esta caja.");
    }
}
