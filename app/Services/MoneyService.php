<?php

declare(strict_types=1);

namespace App\Services;

use InvalidArgumentException;

final class MoneyService
{
    private const HALF_CENT = '0.005';

    /**
     * Rounds a non-negative decimal amount to cents using half-up semantics.
     *
     * This intentionally avoids bcround(), which is unavailable on PHP 8.3.
     *
     * @param  numeric-string  $amount
     * @return numeric-string
     */
    public function roundHalfUp(string $amount): string
    {
        if (preg_match('/^\d+(?:\.\d+)?$/D', $amount) !== 1) {
            throw new InvalidArgumentException('Money amounts must be non-negative decimal strings.');
        }

        /** @var numeric-string $rounded */
        $rounded = bcadd($amount, self::HALF_CENT, 2);

        return $rounded;
    }
}
