<?php

declare(strict_types=1);

namespace App\Actions\Sales;

use App\Models\Product;

final readonly class SaleStockConsumption
{
    /**
     * @param  numeric-string  $quantity
     */
    public function __construct(
        public Product $product,
        public string $quantity,
    ) {}
}
