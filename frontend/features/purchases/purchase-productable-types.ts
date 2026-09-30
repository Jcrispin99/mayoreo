import type { Product } from './purchase-types';

export type PurchaseProductableDraft = {
  key: number;
  productId: number;
  product: Product | null;
  purchaseUnitId: number | null;
  quantity: string;
  unitCost: string;
};
