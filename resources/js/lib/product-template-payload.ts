import type { ProductTemplate, SaleMode, Variant } from "@/types/catalog"

/**
 * El API guarda el producto completo en un solo PUT: atributos y todas las
 * presentaciones. Una presentación omitida se desactiva, por eso cada
 * formulario parte de lo que ya existe y solo cambia su parte.
 */

export type AttributePayload = {
  name: string
  values: string[]
  value_prices: Record<string, string | number>
  value_factors: Record<string, string | number | null>
}

export type VariantPayload = {
  id?: number
  variant_name: string | null
  sku: string
  barcode: string | null
  base_unit_id: number | null
  sale_mode: SaleMode
  content_quantity: string | number | null
  content_unit_id: number | null
  is_active: boolean
  is_favorite: boolean
  is_principal: boolean
  attribute_values: Array<{ attribute: string; value: string }>
  base_price?: number
}

export function attributesPayload(template: ProductTemplate): AttributePayload[] {
  return template.attributes.map((attribute) => ({
    name: attribute.name,
    values: attribute.values.map((value) => value.value),
    value_prices: Object.fromEntries(attribute.values.map((value) => [value.value, value.price])),
    value_factors: Object.fromEntries(attribute.values.map((value) => [value.value, value.factor])),
  }))
}

export function variantPayload(variant: Variant): VariantPayload {
  return {
    id: variant.id,
    variant_name: variant.variant_name,
    sku: variant.sku,
    barcode: variant.barcode,
    base_unit_id: variant.base_unit_id,
    sale_mode: variant.sale_mode,
    content_quantity: variant.sale_mode === "unit" ? variant.content_quantity : null,
    content_unit_id: variant.sale_mode === "unit" ? variant.content_unit_id : null,
    is_active: variant.is_active,
    is_favorite: variant.is_favorite,
    is_principal: variant.is_principal,
    attribute_values: variant.attribute_values.map(({ attribute, value }) => ({ attribute, value })),
  }
}

export function templateFlags(template: ProductTemplate) {
  return {
    name: template.name,
    description: template.description,
    is_active: template.is_active,
    is_pos_visible: template.is_pos_visible,
  }
}
