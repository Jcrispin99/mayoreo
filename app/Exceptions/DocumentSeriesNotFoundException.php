<?php

declare(strict_types=1);

namespace App\Exceptions;

final class DocumentSeriesNotFoundException extends DomainException
{
    public static function forTypeAndCode(string $documentType, string $seriesCode): self
    {
        return new self("No active document series found for type [{$documentType}] and code [{$seriesCode}].");
    }
}
