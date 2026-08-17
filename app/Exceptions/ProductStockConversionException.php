<?php

declare(strict_types=1);

namespace App\Exceptions;

final class ProductStockConversionException extends DomainException
{
    public static function missingPrincipal(int $productId): self
    {
        return new self("La variante [{$productId}] no tiene una variante principal en Kilogramos configurada.");
    }

    public static function missingContent(int $productId): self
    {
        return new self("La variante [{$productId}] necesita un factor y una unidad de contenido para consumir stock en Kilogramos.");
    }

    public static function invalidSaleMode(int $productId): self
    {
        return new self("La variante [{$productId}] debe venderse por unidades para consumir proporcionalmente el stock en Kilogramos.");
    }
}
