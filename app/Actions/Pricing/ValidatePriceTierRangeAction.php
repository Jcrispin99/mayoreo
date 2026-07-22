<?php

declare(strict_types=1);

namespace App\Actions\Pricing;

use App\Exceptions\OverlappingPriceTierException;
use App\Models\PriceTier;
use App\Models\Product;

final class ValidatePriceTierRangeAction
{
    /**
     * Ensures [min_quantity, max_quantity] does not overlap any other
     * active price tier already defined for the product.
     */
    public function execute(Product $product, string $minQuantity, ?string $maxQuantity, ?int $ignoreTierId = null): void
    {
        $overlaps = PriceTier::query()
            ->where('product_id', $product->id)
            ->where('is_active', true)
            ->when($ignoreTierId !== null, fn ($query) => $query->where('id', '!=', $ignoreTierId))
            ->where(function ($query) use ($minQuantity, $maxQuantity): void {
                $query->where('min_quantity', '<=', $maxQuantity ?? PHP_INT_MAX)
                    ->where(function ($inner) use ($minQuantity): void {
                        $inner->whereNull('max_quantity')
                            ->orWhere('max_quantity', '>=', $minQuantity);
                    });
            })
            ->exists();

        if ($overlaps) {
            throw OverlappingPriceTierException::forProduct($product->id);
        }
    }
}
