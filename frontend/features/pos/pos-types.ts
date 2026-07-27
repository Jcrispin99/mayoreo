import type { InventoryTransfer, Store, UnitOfMeasure, Warehouse } from '../inventory/inventory-types';

export type PosDocumentType = 'sales_ticket' | 'receipt' | 'invoice';

export type DocumentSeries = {
  id: number;
  fiscal_issuer_id: number | null;
  document_type: PosDocumentType;
  series_code: string;
  current_number: number;
  next_number: number;
  is_active: boolean;
  assigned_cash_register_id: number | null;
};

export type CashRegister = {
  id: number;
  store_id: number;
  store: Store;
  warehouse_id: number;
  warehouse: Warehouse;
  default_sales_series_id: number;
  default_sales_series: DocumentSeries;
  sales_series: DocumentSeries[];
  code: string;
  name: string;
  is_active: boolean;
};

export type CashSessionStatus = 'open' | 'closed';
export type CashMovementType = 'income' | 'expense';

export type CashRegisterMovement = {
  id: number;
  cash_register_session_id: number;
  type: CashMovementType;
  amount: string;
  reason: string;
  notes: string | null;
  created_by: number | null;
  creator: { id: number; name: string; email: string } | null;
  occurred_at: string;
};

export type CashRegisterSession = {
  id: number;
  cash_register_id: number;
  cash_register: CashRegister;
  status: CashSessionStatus;
  opening_amount: string;
  income_total: string;
  expense_total: string;
  cash_sales_total: string;
  expected_amount: string;
  counted_amount: string | null;
  difference_amount: string | null;
  opening_notes: string | null;
  closing_notes: string | null;
  opened_by: number | null;
  opener: { id: number; name: string; email: string } | null;
  closed_by: number | null;
  closer: { id: number; name: string; email: string } | null;
  opened_at: string;
  closed_at: string | null;
  movements: CashRegisterMovement[];
};

export type PosCatalogPriceTier = {
  id: number;
  product_id: number;
  min_quantity: string;
  max_quantity: string | null;
  unit_price: string;
  label: string | null;
  is_active: boolean;
};

export type PosCatalogProduct = {
  id: number;
  sku: string;
  barcode: string | null;
  name: string;
  image_url: string | null;
  base_unit: UnitOfMeasure | null;
  stock_available: string;
  price_tiers: PosCatalogPriceTier[];
  is_favorite: boolean;
};

export type PosOrderProduct = {
  id: number;
  sku: string;
  barcode: string | null;
  name: string;
  image_url: string | null;
  base_unit: UnitOfMeasure | null;
  price_tiers: PosCatalogPriceTier[];
};

export type PosOrderItem = {
  id: number;
  product_id: number;
  product: PosOrderProduct;
  quantity: string;
  input_quantity: string;
  input_unit_id: number | null;
  price_tier_id: number | null;
  unit_price: string;
  line_total: string;
};

export type PosOrderStatus = 'open' | 'completed' | 'cancelled';

export type PosOrder = {
  id: number;
  cash_register_session_id: number;
  number: number;
  status: PosOrderStatus;
  subtotal: string;
  total: string;
  item_count: number;
  items: PosOrderItem[];
  supply_requests: InventoryTransfer[];
  created_by: number | null;
  created_at: string;
  updated_at: string;
};

export type PosPaymentMethod = 'cash' | 'card' | 'yape' | 'plin' | 'bank_transfer';

export type PosPaymentMethodDefinition = {
  code: PosPaymentMethod;
  label: string;
  description: string;
  requires_received_amount: boolean;
  supports_reference: boolean;
};

export type PosCheckoutPaymentInput =
  | {
    method: 'cash';
    received_amount: string;
    reference: null;
  }
  | {
    method: Exclude<PosPaymentMethod, 'cash'>;
    reference: string | null;
  };

export type PosCheckoutPayload = {
  expected_total: string;
  payment: PosCheckoutPaymentInput;
};

export type PosCheckoutResult = {
  order: {
    id: number;
    number: number;
    status: 'completed';
  };
  sale: {
    id: number;
    total: string;
    payable_total: string;
  };
  payment: {
    method: PosPaymentMethod;
    amount: string;
    received_amount: string | null;
    change_amount: string;
    reference: string | null;
  };
  fiscal_document: {
    document_type: 'sales_ticket';
    series_code: string;
    number: number;
  };
};
