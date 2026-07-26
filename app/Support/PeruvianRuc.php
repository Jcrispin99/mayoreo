<?php

declare(strict_types=1);

namespace App\Support;

use InvalidArgumentException;

final class PeruvianRuc
{
    /** @var list<int> */
    private const WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

    /** @var list<string> */
    private const VALID_PREFIXES = ['10', '15', '16', '17', '20'];

    public static function isValid(string $ruc): bool
    {
        if (preg_match('/^\d{11}$/', $ruc) !== 1
            || ! in_array(mb_substr($ruc, 0, 2), self::VALID_PREFIXES, true)) {
            return false;
        }

        $base = mb_substr($ruc, 0, 10);

        return (int) $ruc[10] === self::checkDigit($base);
    }

    public static function complete(string $tenDigitBase): string
    {
        if (preg_match('/^\d{10}$/', $tenDigitBase) !== 1
            || ! in_array(mb_substr($tenDigitBase, 0, 2), self::VALID_PREFIXES, true)) {
            throw new InvalidArgumentException('La base del RUC debe contener diez dígitos válidos.');
        }

        return $tenDigitBase.self::checkDigit($tenDigitBase);
    }

    private static function checkDigit(string $tenDigitBase): int
    {
        $sum = 0;

        foreach (self::WEIGHTS as $position => $weight) {
            $sum += ((int) $tenDigitBase[$position]) * $weight;
        }

        $digit = 11 - ($sum % 11);

        return $digit >= 10 ? $digit - 10 : $digit;
    }
}
