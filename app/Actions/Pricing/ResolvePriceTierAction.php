<?php

declare(strict_types=1);

namespace App\Actions\Pricing;

use App\Exceptions\NoPriceTierMatchedException;
use App\Models\PriceTier;
use App\Models\Product;

final class ResolvePriceTierAction
{
    /** @param numeric-string $quantityInBaseUnit */
    public function execute(
        Product $product,
        string $quantityInBaseUnit,
        bool $lockForUpdate = false,
    ): PriceTier {
        $query = PriceTier::query()
            ->where('product_id', $product->id)
            ->where('is_active', true)
            ->where('min_quantity', '<=', $quantityInBaseUnit)
            ->where(function ($query) use ($quantityInBaseUnit): void {
                $query->whereNull('max_quantity')
                    ->orWhere('max_quantity', '>=', $quantityInBaseUnit);
            })
            ->orderByDesc('min_quantity');

        if ($lockForUpdate) {
            $query->lockForUpdate();
        }

        $tier = $query->first();

        if (! $tier instanceof PriceTier && $product->sale_mode === 'unit') {
            $fallbackQuery = PriceTier::query()
                ->where('product_id', $product->id)
                ->where('is_active', true)
                ->orderBy('min_quantity');

            if ($lockForUpdate) {
                $fallbackQuery->lockForUpdate();
            }

            $lowestTier = $fallbackQuery->first();
            /** @var numeric-string|null $minimumQuantity */
            $minimumQuantity = $lowestTier instanceof PriceTier
                ? (string) $lowestTier->min_quantity
                : null;
            if (
                $lowestTier instanceof PriceTier
                && $minimumQuantity !== null
                && bccomp($quantityInBaseUnit, $minimumQuantity, 6) < 0
            ) {
                $tier = $lowestTier;
            }
        }

        if (! $tier instanceof PriceTier) {
            throw NoPriceTierMatchedException::forQuantity($product->id, $quantityInBaseUnit);
        }

        return $tier;
    }
}
