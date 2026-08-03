<?php

declare(strict_types=1);

namespace App\Exceptions;

final class PosSupplyRequestException extends DomainException
{
    public static function notAssigned(): self
    {
        return new self('Esta comanda está asignada a otro usuario de almacén.');
    }

    public static function invalidStatus(string $status): self
    {
        return new self("La comanda no admite esta operación en estado [{$status}].");
    }

    public static function reviewRequired(): self
    {
        return new self('Revisa primero la versión más reciente de la comanda.');
    }

    public static function incomplete(): self
    {
        return new self('Todavía existen productos pendientes, parciales o por devolver.');
    }

    public static function itemDoesNotBelong(): self
    {
        return new self('El producto no pertenece a esta comanda.');
    }
}
