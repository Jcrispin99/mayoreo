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

export type PurchaseUnit = {
  id: number;
  product_id: number;
  name: string;
  conversion_factor: string | number;
  is_default_purchase: boolean;
};

export type Product = {
  id: number;
  sku: string;
  name: string;
  is_active: boolean;
  base_unit?: { id: number; code: string; name: string } | null;
  purchase_units?: PurchaseUnit[];
};

export type PurchaseOrderItem = {
  id: number;
  product_id: number;
  product_purchase_unit_id: number | null;
  quantity_purchased: string | number;
  quantity_base: string | number;
  unit_cost: string | number;
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
