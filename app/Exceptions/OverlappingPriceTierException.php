<?php

declare(strict_types=1);

namespace App\Exceptions;

final class OverlappingPriceTierException extends DomainException
{
    public static function forProduct(int $productId): self
    {
        return new self("The given range overlaps with an existing active price tier for product [{$productId}].");
    }
}
