<?php

declare(strict_types=1);

namespace App\Exceptions;

final class CustomerOperationException extends DomainException
{
    public static function inUse(): self
    {
        return new self('El cliente tiene ventas registradas y no puede eliminarse. Puedes desactivarlo.');
    }

    public static function inactive(int $customerId): self
    {
        return new self("El cliente [{$customerId}] está inactivo y no puede usarse en una venta.");
    }
}
