<?php

declare(strict_types=1);

namespace App\Exceptions;

final class NoPriceTierMatchedException extends DomainException
{
    public static function forQuantity(int $productId, string $quantity): self
    {
        return new self("No active price tier matches quantity [{$quantity}] for product [{$productId}].");
    }
}
