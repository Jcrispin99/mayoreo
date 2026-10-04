import type { PriceTier, Unit, Variant } from "@/types/catalog"

/** Acepta coma decimal, como se escribe en Perú. */
export function normalizeDecimal(value: string): string {
  return value.trim().replace(",", ".")
}

export function isPositiveNumber(value: string): boolean {
  const parsed = Number(normalizeDecimal(value))
  return value.trim() !== "" && Number.isFinite(parsed) && parsed > 0
}

/** Número sin ceros sobrantes: 1.500000 → "1.5". */
export function formatDecimal(value: string | number | null | undefined, decimals = 6): string {
  const parsed = Number(value)
  if (value === null || value === undefined || !Number.isFinite(parsed)) return ""
  return parsed.toFixed(decimals).replace(/\.?0+$/, "")
}

export function formatMoney(value: string | number | null | undefined): string {
  const parsed = Number(value)
  return `S/ ${Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00"}`
}

export function unitShort(unit: Pick<Unit, "code"> | null | undefined): string {
  if (!unit) return "und"
  return unit.code === "NIU" ? "und" : unit.code
}

export function formatQuantity(value: string | number | null | undefined, unit: Pick<Unit, "code"> | null | undefined): string {
  const formatted = formatDecimal(value, unit?.code === "kg" ? 3 : 2)
  return `${formatted || "0"} ${unitShort(unit)}`
}

/**
 * Describe un rango de precio igual que la app móvil: los límites como
 * 0.999999 se leen como "menos de 1".
 */
export function formatTierRange(tier: Pick<PriceTier, "min_quantity" | "max_quantity">, unit: Pick<Unit, "code"> | null | undefined): string {
  const min = Number(tier.min_quantity)
  if (tier.max_quantity === null) return `Desde ${formatQuantity(min, unit)}`

  const max = Number(tier.max_quantity)
  const exclusiveLimit = Math.ceil(max)
  const fractionalBoundary = exclusiveLimit > max && exclusiveLimit - max <= 0.0000011
  const shownMax = formatQuantity(fractionalBoundary ? exclusiveLimit : max, unit)

  if (min === 0 && fractionalBoundary) return `Menos de ${shownMax}`
  return `${formatQuantity(min, unit)} a ${fractionalBoundary ? `menos de ${shownMax}` : shownMax}`
}

/** Precio de referencia: el rango activo de menor cantidad mínima. */
export function basePrice(variant: Pick<Variant, "price_tiers">): PriceTier | null {
  return [...(variant.price_tiers ?? [])]
    .filter((tier) => tier.is_active)
    .sort((first, second) => Number(first.min_quantity) - Number(second.min_quantity))[0] ?? null
}

export function variantLabel(variant: Pick<Variant, "variant_name" | "is_principal" | "sale_mode">): string {
  if (variant.variant_name) return variant.variant_name
  if (variant.is_principal) return variant.sale_mode === "measured" ? "Kilogramos" : "Principal"
  return "Presentación"
}

/** SKU sugerido a partir de un texto: "Harina 7 semillas" → "HARINA-7-SEMILLAS". */
export function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}
