export type Warehouse = {
  id: number;
  store_id: number;
  store?: { id: number; code: string; name: string } | null;
  code: string;
  name: string;
  type: 'main' | 'retail' | 'pos';
  is_active: boolean;
  is_default: boolean;
};

export type Store = {
  id: number;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  warehouses: Warehouse[];
};

export type UnitOfMeasure = {
  id: number;
  code: string;
  name: string;
  type: 'weight' | 'volume' | 'count';
};

export type InventoryResourceKind = 'stores' | 'warehouses' | 'units';
export type InventoryItem = Store | Warehouse | UnitOfMeasure;

export type InventoryMovementFlow = 'all' | 'in' | 'out';

export type InventoryMovement = {
  id: number;
  product_id: number;
  product: { id: number; sku: string; name: string; base_unit: { id: number; code: string; name: string } | null };
  warehouse_id: number;
  warehouse: { id: number; code: string; name: string };
  type: 'purchase' | 'transfer_in' | 'transfer_out' | 'sale' | 'adjustment';
  flow: 'in' | 'out';
  quantity: string | number;
  direction: 'increase' | 'decrease' | null;
  unit_cost: string | number | null;
  balance_quantity: string | number;
  balance_unit_cost: string | number;
  balance_total_cost: string | number;
  reference_type: string | null;
  reference_id: number | null;
  notes: string | null;
  created_at: string;
};
