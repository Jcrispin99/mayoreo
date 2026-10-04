/** Formas de los recursos de /api/v1 usados por catálogo e inventario. */

export type Unit = {
  id: number
  code: string
  name: string
  type: "weight" | "volume" | "count"
}

export type SaleMode = "unit" | "measured"

export type PriceTier = {
  id: number
  product_id: number
  min_quantity: string
  max_quantity: string | null
  unit_price: string
  label: string | null
  is_active: boolean
}

export type PurchaseUnit = {
  id: number
  product_id: number
  name: string
  conversion_factor: string
  barcode: string | null
  is_default_purchase: boolean
}

export type AttributeSelection = {
  attribute: string
  value: string
}

export type Variant = {
  id: number
  product_template_id: number
  sku: string
  barcode: string | null
  name: string
  display_name: string
  variant_name: string | null
  image_url: string | null
  base_unit_id: number
  base_unit?: Unit | null
  sale_mode: SaleMode
  content_quantity: string | null
  content_unit_id: number | null
  content_unit?: Unit | null
  attribute_values: Array<AttributeSelection & { id: number; attribute_id: number }>
  is_active: boolean
  is_favorite: boolean
  is_principal: boolean
  purchase_units?: PurchaseUnit[]
  price_tiers?: PriceTier[]
}

export type TemplateAttribute = {
  id: number
  name: string
  values: Array<{
    id: number
    value: string
    price: string
    factor: string | null
  }>
}

export type ProductTemplate = {
  id: number
  name: string
  description: string | null
  image_url: string | null
  is_active: boolean
  is_pos_visible: boolean
  attributes: TemplateAttribute[]
  variants: Variant[]
}

export type WarehouseType = "main" | "retail" | "pos"

export type Warehouse = {
  id: number
  store_id: number
  store?: { id: number; code: string; name: string } | null
  code: string
  name: string
  type: WarehouseType
  is_active: boolean
  is_default: boolean
}

export type Store = {
  id: number
  code: string
  name: string
  address: string | null
  phone: string | null
  is_active: boolean
  warehouses: Warehouse[]
}

export type StockRecord = {
  id: number
  warehouse_id: number
  warehouse?: Warehouse
  product_id: number
  product?: Variant
  quantity: string
  average_cost: string
  total_cost: string
  updated_at: string | null
}

export type MovementType = "purchase" | "transfer_in" | "transfer_out" | "sale" | "adjustment"

export type InventoryMovement = {
  id: number
  product_id: number
  product?: { id: number; sku: string; name: string; base_unit: Pick<Unit, "id" | "code" | "name"> | null }
  warehouse_id: number
  warehouse?: { id: number; code: string; name: string }
  type: MovementType
  flow: "in" | "out"
  quantity: string
  direction: "increase" | "decrease" | null
  unit_cost: string | null
  balance_quantity: string
  balance_unit_cost: string
  balance_total_cost: string
  notes: string | null
  created_at: string | null
}
