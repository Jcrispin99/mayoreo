<?php

declare(strict_types=1);

namespace App\Exceptions;

final class FiscalDocumentAlreadyExchangedException extends DomainException
{
    public static function forSale(int $saleId): self
    {
        return new self("The sales ticket for sale [{$saleId}] has already been exchanged for a fiscal document.");
    }
}
