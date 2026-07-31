<?php

declare(strict_types=1);

namespace App\Actions\Sales;

use App\Exceptions\ProductStockConversionException;
use App\Models\Product;
use App\Models\UnitOfMeasure;
use App\Services\UnitConversionService;

final readonly class ResolveSaleStockConsumptionAction
{
    public function __construct(
        private UnitConversionService $unitConversionService,
    ) {}

    /**
     * @param  numeric-string  $saleQuantity
     */
    public function execute(
        Product $soldProduct,
        string $saleQuantity,
        bool $lockForUpdate = true,
    ): SaleStockConsumption {
        if ($soldProduct->is_principal || $soldProduct->product_template_id === null) {
            return new SaleStockConsumption(
                $soldProduct,
                bcadd($saleQuantity, '0', 6),
            );
        }

        $principalQuery = Product::query()
            ->where('product_template_id', $soldProduct->product_template_id)
            ->where('is_principal', true);

        if ($lockForUpdate) {
            $principalQuery->lockForUpdate();
        }

        $principal = $principalQuery->first();

        if (! $principal instanceof Product) {
            throw ProductStockConversionException::missingPrincipal($soldProduct->id);
        }

        if ($soldProduct->sale_mode !== 'unit') {
            throw ProductStockConversionException::invalidSaleMode($soldProduct->id);
        }

        $contentUnit = $soldProduct->contentUnit()->first();
        if (
            $soldProduct->content_quantity === null
            || ! $contentUnit instanceof UnitOfMeasure
        ) {
            throw ProductStockConversionException::missingContent($soldProduct->id);
        }

        /** @var numeric-string $contentQuantity */
        $contentQuantity = (string) $soldProduct->content_quantity;
        if (bccomp($contentQuantity, '0', 6) <= 0) {
            throw ProductStockConversionException::missingContent($soldProduct->id);
        }

        $contentInPrincipalUnit = $this->unitConversionService->toBaseUnitFromCode(
            $principal,
            $contentQuantity,
            $contentUnit->code,
        );
        /** @var numeric-string $stockQuantity */
        $stockQuantity = bcmul($saleQuantity, $contentInPrincipalUnit, 6);

        return new SaleStockConsumption($principal, $stockQuantity);
    }
}
