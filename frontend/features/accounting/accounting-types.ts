import type { Customer } from '../customers/customer-types';
import type { UnitOfMeasure, Warehouse } from '../inventory/inventory-types';
import type {
  CashRegisterSession,
  DocumentSeries,
  PosPaymentMethod,
  PosPaymentMethodDefinition,
} from '../pos/pos-types';

export type AccountingPriceTier = {
  id: number;
  product_id: number;
  min_quantity: string;
  max_quantity: string | null;
  unit_price: string;
  label: string | null;
  is_active: boolean;
};

export type AccountingProduct = {
  id: number;
  sku: string;
  name: string;
  is_active: boolean;
  base_unit_id: number;
  base_unit: UnitOfMeasure | null;
  price_tiers: AccountingPriceTier[];
};

export type AccountingSaleItem = {
  id: number;
  product_id: number;
  quantity: string;
  input_quantity: string;
  input_unit_id: number | null;
  unit_price: string;
  line_total: string;
  product: AccountingProduct;
  input_unit: UnitOfMeasure | null;
  price_tier: AccountingPriceTier | null;
};

export type AccountingSalePayment = {
  id: number;
  method: PosPaymentMethod;
  amount: string;
  received_amount: string | null;
  change_amount: string;
  reference: string | null;
  paid_at: string;
};

export type AccountingFiscalDocument = {
  id: number;
  document_type: 'sales_ticket' | 'receipt' | 'invoice';
  series_code: string;
  number: number;
  full_number: string;
  status: string;
  issued_at: string;
};

export type AccountingSale = {
  id: number;
  warehouse_id: number;
  warehouse: Warehouse;
  cash_register_session_id: number | null;
  pos_order_id: number | null;
  customer_id: number | null;
  customer: Customer | null;
  source: 'pos' | 'wholesale';
  customer_name: string | null;
  customer_document: string | null;
  notes: string | null;
  status: 'completed' | 'voided';
  subtotal: string;
  total: string;
  payable_total: string;
  sold_at: string;
  items: AccountingSaleItem[];
  payments: AccountingSalePayment[];
  fiscal_documents: AccountingFiscalDocument[];
  primary_document: AccountingFiscalDocument | null;
  creator: { id: number; name: string; email: string } | null;
  created_at: string;
  updated_at: string;
};

export type AccountingSummary = {
  totals: {
    gross_sales: string;
    transactions: number;
    average_ticket: string;
  };
  by_source: Array<{ source: string; count: number; total: string }>;
  by_payment_method: Array<{ method: string; count: number; total: string }>;
  daily: Array<{ date: string; count: number; total: string }>;
};

export type AccountingSaleDraftLine = {
  key: number;
  productId: number | null;
  quantity: string;
  unitCode: string;
};

export type AccountingFormReferences = {
  customers: Customer[];
  warehouses: Warehouse[];
  products: AccountingProduct[];
  series: DocumentSeries[];
  paymentMethods: PosPaymentMethodDefinition[];
  cashSessions: CashRegisterSession[];
  units: UnitOfMeasure[];
};

