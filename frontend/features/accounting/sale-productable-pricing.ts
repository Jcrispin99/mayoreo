import type { UnitOfMeasure } from '../inventory/inventory-types';
import type {
  AccountingProduct,
  AccountingSaleDraftLine,
} from './accounting-types';

const UNIT_FACTORS: Record<string, Record<string, number>> = {
  weight: { g: 1, kg: 1000 },
  volume: { ml: 1, l: 1000 },
  count: { unit: 1, unidad: 1, un: 1, und: 1 },
};

function baseQuantity(product: AccountingProduct, quantity: string, unitCode: string) {
  const numericQuantity = Number(quantity);
  const baseUnit = product.base_unit;
  if (!baseUnit || !Number.isFinite(numericQuantity) || numericQuantity <= 0) return null;

  const factors = UNIT_FACTORS[baseUnit.type] ?? {};
  const inputFactor = factors[unitCode.toLocaleLowerCase('es')];
  const baseFactor = factors[baseUnit.code.toLocaleLowerCase('es')];
  if (!inputFactor || !baseFactor) return null;
  return (numericQuantity * inputFactor) / baseFactor;
}

export function saleLinePreview(
  line: AccountingSaleDraftLine,
  products: AccountingProduct[],
) {
  const product = products.find((item) => item.id === line.productId);
  if (!product) return null;
  const quantity = baseQuantity(product, line.quantity, line.unitCode);
  if (quantity === null) return null;

  const tier = [...product.price_tiers]
    .sort((a, b) => Number(b.min_quantity) - Number(a.min_quantity))
    .find((item) => (
      Number(item.min_quantity) <= quantity
      && (item.max_quantity === null || Number(item.max_quantity) >= quantity)
    ));
  if (!tier) return null;

  return {
    product,
    quantity,
    tier,
    total: quantity * Number(tier.unit_price),
  };
}

export function saleUnitsForProduct(
  product: AccountingProduct | undefined,
  units: UnitOfMeasure[],
) {
  if (!product?.base_unit) return [];
  const supportedCodes = Object.keys(UNIT_FACTORS[product.base_unit.type] ?? {});
  const matching = units.filter((unit) => (
    unit.type === product.base_unit?.type
    && supportedCodes.includes(unit.code.toLocaleLowerCase('es'))
  ));

  if (!matching.some((unit) => unit.id === product.base_unit?.id)) {
    return [product.base_unit, ...matching];
  }
  return matching;
}
