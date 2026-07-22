<?php

declare(strict_types=1);

namespace App\Actions\Catalog;

use App\Models\Product;
use App\Models\ProductPurchaseUnit;
use App\Services\UnitConversionService;

final readonly class ConvertToBaseUnitAction
{
    public function __construct(
        private UnitConversionService $unitConversionService,
    ) {}

    public function execute(Product $product, string $quantity, ?ProductPurchaseUnit $purchaseUnit = null): string
    {
        return $this->unitConversionService->toBaseUnit($product, $quantity, $purchaseUnit);
    }
}
