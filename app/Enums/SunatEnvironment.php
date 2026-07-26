<?php

declare(strict_types=1);

namespace App\Enums;

enum SunatEnvironment: string
{
    case Beta = 'beta';
    case Production = 'production';

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(
            static fn (self $environment): string => $environment->value,
            self::cases(),
        );
    }
}
