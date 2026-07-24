<?php

declare(strict_types=1);

namespace App\Exceptions;

use App\Models\PosOrder;
use RuntimeException;

final class PosCheckoutTotalChangedException extends RuntimeException
{
    public function __construct(
        private readonly PosOrder $order,
        private readonly string $payableTotal,
    ) {
        parent::__construct('El total de la orden cambió. Revísalo antes de cobrar.');
    }

    public function order(): PosOrder
    {
        return $this->order;
    }

    public function payableTotal(): string
    {
        return $this->payableTotal;
    }
}
