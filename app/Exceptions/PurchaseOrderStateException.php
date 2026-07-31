<?php

declare(strict_types=1);

namespace App\Exceptions;

final class PurchaseOrderStateException extends DomainException
{
    public static function notDraft(int $purchaseOrderId): self
    {
        return new self("La orden de compra [{$purchaseOrderId}] ya no está en borrador.");
    }
}
