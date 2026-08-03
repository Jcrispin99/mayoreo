<?php

declare(strict_types=1);

namespace App\Exceptions;

use RuntimeException;

final class StalePosSupplyRequestException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('La comanda cambió. Recarga la versión más reciente antes de continuar.');
    }
}
