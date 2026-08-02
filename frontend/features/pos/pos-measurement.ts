import type { UnitOfMeasure } from '../inventory/inventory-types';
import type { PosCatalogPriceTier } from './pos-types';

export type PosSaleUnitCode = 'g' | 'kg' | 'ml' | 'l';

export type PosSaleUnitOption = {
  code: PosSaleUnitCode;
  factor: number;
  label: string;
  quickValues: number[];
};

export type PosMeasuredProduct = {
  id: number;
  name: string;
  sku: string;
  sale_mode?: 'unit' | 'measured';
  base_unit: UnitOfMeasure | null;
  price_tiers: PosCatalogPriceTier[];
};

function normalizedBaseCode(baseUnit: UnitOfMeasure | null) {
  return baseUnit?.code.trim().toLocaleLowerCase('es') ?? '';
}

export function saleUnitOptions(baseUnit: UnitOfMeasure | null): PosSaleUnitOption[] {
  const code = normalizedBaseCode(baseUnit);

  if (baseUnit?.type === 'weight' && (code === 'g' || code === 'gr')) {
    return [
      { code: 'kg', factor: 1000, label: 'kg', quickValues: [0.25, 0.5, 1, 2, 5] },
      { code: 'g', factor: 1, label: 'g', quickValues: [100, 250, 500] },
    ];
  }

  if (baseUnit?.type === 'volume' && code === 'ml') {
    return [
      { code: 'l', factor: 1000, label: 'L', quickValues: [0.5, 1, 2, 5] },
      { code: 'ml', factor: 1, label: 'ml', quickValues: [250, 500, 750] },
    ];
  }

  return [];
}

export function isMeasuredProduct(product: PosMeasuredProduct) {
  if (product.sale_mode) return product.sale_mode === 'measured';
  return saleUnitOptions(product.base_unit).length > 0;
}

export function resolvePriceTier(
  tiers: PosCatalogPriceTier[],
  quantityInBaseUnit: number,
) {
  if (!Number.isFinite(quantityInBaseUnit) || quantityInBaseUnit <= 0) return null;

  return [...tiers]
    .filter((tier) => tier.is_active !== false)
    .sort((left, right) => Number(right.min_quantity) - Number(left.min_quantity))
    .find((tier) => (
      Number(tier.min_quantity) <= quantityInBaseUnit
      && (tier.max_quantity === null || Number(tier.max_quantity) >= quantityInBaseUnit)
    )) ?? null;
}

export function pricingDisplay(baseUnit: UnitOfMeasure | null) {
  const code = normalizedBaseCode(baseUnit);

  if (code === 'g' || code === 'gr') return { factor: 1000, unit: 'kg' };
  if (code === 'ml') return { factor: 1000, unit: 'L' };

  return { factor: 1, unit: baseUnit?.code ?? 'un.' };
}

export function formatPosQuantity(value: number, maximumFractionDigits = 3) {
  return new Intl.NumberFormat('es-PE', { maximumFractionDigits }).format(value);
}

export function formatBaseQuantity(value: number, baseUnit: UnitOfMeasure | null) {
  const code = normalizedBaseCode(baseUnit);

  if ((code === 'g' || code === 'gr') && value >= 1000) {
    return `${formatPosQuantity(value / 1000)} kg`;
  }
  if (code === 'ml' && value >= 1000) {
    return `${formatPosQuantity(value / 1000)} L`;
  }

  return `${formatPosQuantity(value)} ${baseUnit?.code ?? 'un.'}`;
}

export function catalogPriceSummary(product: PosMeasuredProduct) {
  const activeTiers = product.price_tiers.filter((tier) => tier.is_active !== false);
  if (activeTiers.length === 0) return null;

  const initialTier = resolvePriceTier(activeTiers, 1)
    ?? [...activeTiers].sort((left, right) => Number(left.min_quantity) - Number(right.min_quantity))[0];
  const lowestTier = [...activeTiers].sort(
    (left, right) => Number(left.unit_price) - Number(right.unit_price),
  )[0];
  const display = pricingDisplay(product.base_unit);
  const initialAmount = Number(initialTier.unit_price) * display.factor;
  const lowestAmount = Number(lowestTier.unit_price) * display.factor;

  return {
    amount: initialAmount,
    unit: display.unit,
    lowerAmount: lowestAmount < initialAmount ? lowestAmount : null,
    lowerFrom: lowestAmount < initialAmount
      ? formatBaseQuantity(Number(lowestTier.min_quantity), product.base_unit)
      : null,
  };
}
