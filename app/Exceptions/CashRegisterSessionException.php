<?php

declare(strict_types=1);

namespace App\Exceptions;

final class CashRegisterSessionException extends DomainException
{
    public static function inactiveRegister(): self
    {
        return new self('No se puede abrir una caja inactiva.');
    }

    public static function alreadyOpen(int $cashRegisterId): self
    {
        return new self("La caja [{$cashRegisterId}] ya tiene una apertura activa.");
    }

    public static function alreadyClosed(int $sessionId): self
    {
        return new self("La apertura de caja [{$sessionId}] ya está cerrada.");
    }

    public static function hasOpenOrders(int $sessionId): self
    {
        return new self("La apertura de caja [{$sessionId}] todavía tiene órdenes abiertas.");
    }
}
