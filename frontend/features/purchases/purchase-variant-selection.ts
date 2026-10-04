import type { UnitOfMeasure } from '../inventory/inventory-types';

type NormalizableVariant = {
  is_principal: boolean;
  sale_mode: 'unit' | 'measured';
  content_quantity: string | null;
  content_unit: UnitOfMeasure | null;
};

const UNIT_FACTORS: Record<string, Record<string, number>> = {
  weight: { g: 1, kg: 1000 },
  volume: { ml: 1, l: 1000 },
  count: { niu: 1, unit: 1, unidad: 1, un: 1, und: 1 },
};

/**
 * Cuánto representa una variante en la unidad base del principal de su
 * template, normalizado a un número comparable. El principal siempre vale 1.
 * Cualquier caso ambiguo (unidades incompatibles, contenido faltante) cae a 1
 * en vez de lanzar: esto es solo un default de UI, la validación real ocurre
 * en el backend.
 */
export function normalizedVariantQuantity(
  variant: NormalizableVariant,
  principalBaseUnit: UnitOfMeasure | null,
): number {
  if (variant.is_principal) return 1;
  if (variant.sale_mode !== 'unit' || !variant.content_quantity || !variant.content_unit || !principalBaseUnit) return 1;

  const contentQuantity = Number(variant.content_quantity);
  if (!Number.isFinite(contentQuantity) || contentQuantity <= 0) return 1;
  if (variant.content_unit.type !== principalBaseUnit.type) return 1;

  const contentFactor = UNIT_FACTORS[variant.content_unit.type]?.[variant.content_unit.code.toLowerCase()];
  const baseFactor = UNIT_FACTORS[principalBaseUnit.type]?.[principalBaseUnit.code.toLowerCase()];
  if (!contentFactor || !baseFactor) return 1;

  return (contentQuantity * contentFactor) / baseFactor;
}

/**
 * Variante a preseleccionar por defecto al abrir un template: la de mayor
 * cantidad normalizada (ej. "Saco 50kg" antes que "Kg suelto").
 */
export function pickDefaultVariant<T extends NormalizableVariant & { id: number; base_unit: UnitOfMeasure | null }>(
  variants: T[],
): T | undefined {
  if (variants.length === 0) return undefined;

  const principal = variants.find((candidate) => candidate.is_principal) ?? variants[0];

  return variants.reduce(
    (best, candidate) => (
      normalizedVariantQuantity(candidate, principal.base_unit) > normalizedVariantQuantity(best, principal.base_unit)
        ? candidate
        : best
    ),
    principal,
  );
}
