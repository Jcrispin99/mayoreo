<?php

declare(strict_types=1);

namespace App\Exceptions;

use RuntimeException;

final class DeviceAlreadyLinkedException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('La cuenta ya tiene otro dispositivo vinculado.');
    }
}
