<?php

declare(strict_types=1);

namespace App\Exceptions;

final class FiscalIdentityConfigurationException extends DomainException
{
    public static function incompleteEstablishment(int $storeId): self
    {
        return new self(
            sprintf('La tienda [%d] no tiene completa su dirección de establecimiento SUNAT.', $storeId),
        );
    }

    public static function inactiveIssuer(int $fiscalIssuerId): self
    {
        return new self(
            sprintf('El emisor fiscal [%d] está inactivo o ya no existe.', $fiscalIssuerId),
        );
    }

    public static function seriesIssuerMismatch(int $seriesId): self
    {
        return new self(
            sprintf('La serie fiscal [%d] no pertenece al emisor configurado para la tienda.', $seriesId),
        );
    }
}
