<?php

declare(strict_types=1);

namespace App\Exceptions;

use RuntimeException;

final class WholesaleSaleTotalChangedException extends RuntimeException
{
    /**
     * @param  list<array{
     *     product_id: int,
     *     quantity: numeric-string,
     *     price_tier_id: int,
     *     unit_price: numeric-string,
     *     line_total: numeric-string
     * }>  $items
     */
    public function __construct(
        private readonly string $subtotal,
        private readonly string $payableTotal,
        private readonly array $items,
    ) {
        parent::__construct('El total de la venta cambió. Revisa los precios antes de confirmar.');
    }

    /** @return array<string, mixed> */
    public function data(): array
    {
        return [
            'subtotal' => $this->subtotal,
            'payable_total' => $this->payableTotal,
            'items' => $this->items,
        ];
    }
}
