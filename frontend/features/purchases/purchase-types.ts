import type { UnitOfMeasure } from '../inventory/inventory-types';

export type Supplier = {
  id: number;
  name: string;
  document_number: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
};

export type Warehouse = {
  id: number;
  code: string;
  name: string;
  type: 'main' | 'retail' | 'pos';
  is_active: boolean;
};

export type Product = {
  id: number;
  product_template_id: number | null;
  template?: { id: number; name: string; is_active: boolean; is_pos_visible: boolean } | null;
  sku: string;
  barcode: string | null;
  name: string;
  variant_name: string | null;
  display_name: string;
  is_active: boolean;
  is_principal: boolean;
  sale_mode: 'unit' | 'measured';
  base_unit: UnitOfMeasure | null;
  content_quantity: string | null;
  content_unit: UnitOfMeasure | null;
};

export type ProductTemplate = {
  id: number;
  name: string;
  is_active: boolean;
  is_pos_visible: boolean;
  variants: Product[];
};

export type ProductTemplatePage = {
  items: ProductTemplate[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
  };
};

export type PurchaseOrderItem = {
  id: number;
  product_id: number;
  product_purchase_unit_id: number | null;
  quantity_purchased: string | number;
  quantity_base: string | number;
  stock_product_id: number | null;
  stock_quantity: string | number | null;
  unit_cost: string | number;
  product?: Product;
};

export type PurchaseOrder = {
  id: number;
  series_code: string | null;
  number: number | null;
  full_number: string | null;
  supplier_id: number;
  warehouse_id: number;
  status: 'draft' | 'confirmed' | 'cancelled';
  ordered_at: string;
  invoice_series: string | null;
  invoice_number: string | null;
  invoice_full_number: string | null;
  total: string | number;
  notes: string | null;
  items: PurchaseOrderItem[];
  created_at: string;
};
