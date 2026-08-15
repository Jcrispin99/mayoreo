<?php

declare(strict_types=1);

namespace App\Services\HistoricalSales;

use App\Models\PriceTier;
use App\Models\Product;
use App\Models\Stock;
use App\Models\UnitOfMeasure;
use App\Models\Warehouse;
use App\Services\MoneyService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Collection;

final readonly class HistoricalSaleProposalGenerator
{
    public function __construct(private MoneyService $moneyService) {}

    /**
     * @param  numeric-string  $targetTotal
     * @return list<array{product_id: int, product_name: string, quantity: string, unit_id: int, unit_code: string, unit_price: string, line_total: string}>
     */
    public function generate(Warehouse $warehouse, string $targetTotal, string $seed): array
    {
        $products = Product::query()
            ->where('is_active', true)
            ->where(fn (Builder $query): Builder => $query->where('is_principal', true)->orWhereNull('product_template_id'))
            ->whereHas('priceTiers', fn (Builder $query): Builder => $query->where('is_active', true))
            ->whereHas('stocks', fn (Builder $query): Builder => $query
                ->where('warehouse_id', $warehouse->id)
                ->where('quantity', '>', 0))
            ->with([
                'baseUnit',
                'template',
                'priceTiers' => function (Relation $relation): void {
                    $relation->getQuery()->where('is_active', true)->orderBy('min_quantity');
                },
                'stocks' => function (Relation $relation) use ($warehouse): void {
                    $relation->getQuery()->where('warehouse_id', $warehouse->id);
                },
            ])
            ->get()
            ->sortBy(fn (Product $product): string => hash('sha256', $seed.'|'.$product->id))
            ->values();

        $weighted = $products->where('sale_mode', '!=', 'unit')->values();
        $unitOptions = $this->unitOptions($products->where('sale_mode', 'unit')->values(), $targetTotal);
        /** @var list<list<array{product_id: int, product_name: string, quantity: string, unit_id: int, unit_code: string, unit_price: string, line_total: string}>> $prefixes */
        $prefixes = [];

        foreach ($unitOptions as $unitOption) {
            $prefixes[] = [$unitOption];
        }

        $prefixes[] = [];

        foreach ($prefixes as $prefix) {
            $prefixTotal = $this->subtotal($prefix);
            /** @var numeric-string $remaining */
            $remaining = bcsub($targetTotal, $prefixTotal, 4);

            if (bccomp($remaining, '0', 4) === 0 && $prefix !== []) {
                return $prefix;
            }

            if (bccomp($remaining, '0', 4) <= 0) {
                continue;
            }

            foreach ($weighted as $product) {
                $filler = $this->weightedItem($product, $remaining, $targetTotal, $prefixTotal);

                if ($filler !== null) {
                    return [...$prefix, $filler];
                }
            }
        }

        return [];
    }

    /**
     * @param  Collection<int, Product>  $products
     * @param  numeric-string  $targetTotal
     * @return Collection<int, array{product_id: int, product_name: string, quantity: string, unit_id: int, unit_code: string, unit_price: string, line_total: string}>
     */
    private function unitOptions(Collection $products, string $targetTotal): Collection
    {
        /** @var Collection<int, array{product_id: int, product_name: string, quantity: string, unit_id: int, unit_code: string, unit_price: string, line_total: string}> $options */
        $options = collect();

        foreach ($products as $product) {
            $stockModel = $product->stocks->first();
            assert($stockModel instanceof Stock);
            /** @var numeric-string $stock */
            $stock = (string) $stockModel->quantity;
            $maximum = min(5, (int) floor((float) $stock));

            for ($quantity = 1; $quantity <= $maximum; $quantity++) {
                $normalizedQuantity = number_format($quantity, 6, '.', '');
                $tier = $this->tierFor($product, $normalizedQuantity);

                if (! $tier instanceof PriceTier) {
                    continue;
                }

                /** @var numeric-string $price */
                $price = (string) $tier->unit_price;
                /** @var numeric-string $lineTotal */
                $lineTotal = bcmul($normalizedQuantity, $price, 4);

                if (bccomp($lineTotal, $targetTotal, 4) > 0) {
                    continue;
                }

                $options->push($this->item($product, $normalizedQuantity, $price, $lineTotal));
            }
        }

        return $options;
    }

    /**
     * @param  numeric-string  $remaining
     * @param  numeric-string  $targetTotal
     * @param  numeric-string  $prefixTotal
     * @return array{product_id: int, product_name: string, quantity: string, unit_id: int, unit_code: string, unit_price: string, line_total: string}|null
     */
    private function weightedItem(Product $product, string $remaining, string $targetTotal, string $prefixTotal): ?array
    {
        $stockModel = $product->stocks->first();
        assert($stockModel instanceof Stock);
        /** @var numeric-string $stock */
        $stock = (string) $stockModel->quantity;

        foreach ($product->priceTiers as $tier) {
            /** @var numeric-string $price */
            $price = (string) $tier->unit_price;

            if (bccomp($price, '0', 4) <= 0) {
                continue;
            }

            /** @var numeric-string $baseQuantity */
            $baseQuantity = bcdiv($remaining, $price, 6);

            for ($step = -5; $step <= 5; $step++) {
                /** @var numeric-string $quantity */
                $quantity = bcadd($baseQuantity, bcmul((string) $step, '0.000001', 6), 6);

                if (bccomp($quantity, '0', 6) <= 0 || bccomp($quantity, $stock, 6) > 0) {
                    continue;
                }

                $resolvedTier = $this->tierFor($product, $quantity);

                if (! $resolvedTier instanceof PriceTier || $resolvedTier->id !== $tier->id) {
                    continue;
                }

                /** @var numeric-string $lineTotal */
                $lineTotal = bcmul($quantity, $price, 4);
                /** @var numeric-string $subtotal */
                $subtotal = bcadd($prefixTotal, $lineTotal, 4);

                if (bccomp($this->moneyService->roundHalfUp($subtotal), $targetTotal, 2) === 0) {
                    return $this->item($product, $quantity, $price, $lineTotal);
                }
            }
        }

        return null;
    }

    private function tierFor(Product $product, string $quantity): ?PriceTier
    {
        return $product->priceTiers->first(function (PriceTier $tier) use ($quantity): bool {
            /** @var numeric-string $minimum */
            $minimum = (string) $tier->min_quantity;
            /** @var numeric-string|null $maximum */
            $maximum = $tier->max_quantity === null ? null : (string) $tier->max_quantity;
            /** @var numeric-string $normalizedQuantity */
            $normalizedQuantity = $quantity;

            return bccomp($minimum, $normalizedQuantity, 6) <= 0
                && ($maximum === null || bccomp($maximum, $normalizedQuantity, 6) >= 0);
        });
    }

    /**
     * @param  list<array{line_total: string}>  $items
     * @return numeric-string
     */
    private function subtotal(array $items): string
    {
        /** @var numeric-string $total */
        $total = '0.0000';

        foreach ($items as $item) {
            /** @var numeric-string $lineTotal */
            $lineTotal = $item['line_total'];
            $total = bcadd($total, $lineTotal, 4);
        }

        return $total;
    }

    /**
     * @param  numeric-string  $quantity
     * @param  numeric-string  $price
     * @param  numeric-string  $lineTotal
     * @return array{product_id: int, product_name: string, quantity: string, unit_id: int, unit_code: string, unit_price: string, line_total: string}
     */
    private function item(Product $product, string $quantity, string $price, string $lineTotal): array
    {
        $baseUnit = $product->baseUnit;
        assert($baseUnit instanceof UnitOfMeasure);

        return [
            'product_id' => $product->id,
            'product_name' => $product->display_name,
            'quantity' => $quantity,
            'unit_id' => $product->base_unit_id,
            'unit_code' => $baseUnit->code,
            'unit_price' => $price,
            'line_total' => $lineTotal,
        ];
    }
}
