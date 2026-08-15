<?php

declare(strict_types=1);

namespace App\Observers;

use App\Models\Product;
use App\Services\ProductBarcodeGenerator;

final class ProductObserver
{
    public function __construct(
        private readonly ProductBarcodeGenerator $productBarcodeGenerator,
    ) {}

    public function saving(Product $product): void
    {
        $barcode = $product->getAttribute('barcode');
        if (is_string($barcode) && mb_trim($barcode) !== '') {
            return;
        }

        $product->setAttribute('barcode', $this->productBarcodeGenerator->generate());
    }
}
