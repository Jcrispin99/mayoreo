<?php

declare(strict_types=1);

namespace App\Exceptions;

final class LocationOperationException extends DomainException
{
    public static function warehouseInUse(): self
    {
        return new self('El almacén tiene existencias u operaciones y no puede eliminarse. Puedes desactivarlo.');
    }

    public static function defaultWarehouse(): self
    {
        return new self('Selecciona otro almacén predeterminado antes de modificar o eliminar este almacén.');
    }

    public static function storeInUse(): self
    {
        return new self('La tienda tiene almacenes con existencias u operaciones y no puede eliminarse. Puedes desactivarla.');
    }

    public static function inactiveWarehouse(): self
    {
        return new self('No se pueden realizar transferencias con un almacén inactivo.');
    }

    public static function unitInUse(): self
    {
        return new self('La unidad está siendo utilizada por productos o ventas y no puede eliminarse.');
    }
}
