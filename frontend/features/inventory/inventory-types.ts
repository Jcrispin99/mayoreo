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
  fiscal_issuer_id: number | null;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  sunat_establishment_code: string | null;
  sunat_address: string | null;
  sunat_ubigeo: string | null;
  sunat_urbanization: string | null;
  sunat_department: string | null;
  sunat_province: string | null;
  sunat_district: string | null;
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

export type InventoryTransferStatus = 'draft' | 'in_transit' | 'received' | 'cancelled';

export type WarehouseAssignee = {
  id: number;
  name: string;
};

export type InventoryTransferItem = {
  id: number;
  product_id: number;
  product?: { id: number; sku: string; name: string; base_unit: UnitOfMeasure | null } | null;
  quantity: string;
  unit_cost: string | null;
};

/**
 * Cuando pos_order_id no es null, este traslado es una "comanda": una
 * solicitud de reposición generada desde una orden del POS que no tenía
 * stock suficiente en el almacén de su caja.
 */
export type InventoryTransfer = {
  id: number;
  from_warehouse_id: number;
  to_warehouse_id: number;
  pos_order_id: number | null;
  pos_order_number?: number | null;
  assigned_to?: number | null;
  assignee?: WarehouseAssignee | null;
  assigned_at?: string | null;
  status: InventoryTransferStatus;
  dispatched_at: string | null;
  received_at: string | null;
  notes: string | null;
  items: InventoryTransferItem[];
  created_at: string;
};

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
