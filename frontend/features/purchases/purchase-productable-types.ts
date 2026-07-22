import type { PurchaseUnit } from './purchase-types';

export type PurchaseProductableDraft = {
  key: number;
  productId: number;
  purchaseUnitId: number | null;
  purchaseUnits: PurchaseUnit[];
  quantity: string;
  unitCost: string;
};
