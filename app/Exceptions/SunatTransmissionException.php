<?php

declare(strict_types=1);

namespace App\Exceptions;

final class SunatTransmissionException extends DomainException
{
    public static function unsupportedDocument(string $documentType): self
    {
        return new self(sprintf('El documento [%s] no se puede enviar a SUNAT.', $documentType));
    }

    public static function missingIdentity(): self
    {
        return new self('El documento no contiene una identidad fiscal completa.');
    }

    public static function missingCredentials(): self
    {
        return new self('El emisor no tiene credenciales SOL y certificado vigentes.');
    }

    public static function invalidCustomer(string $message): self
    {
        return new self($message);
    }

    public static function emptySale(): self
    {
        return new self('La venta no contiene líneas que puedan enviarse a SUNAT.');
    }

    public static function alreadyProcessing(): self
    {
        return new self('El documento ya está siendo enviado a SUNAT.');
    }

    public static function transportFailure(string $message): self
    {
        return new self('No se pudo completar el envío a SUNAT: '.$message);
    }
}
