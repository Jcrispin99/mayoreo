export type PurchaseProductableDraft = {
  key: number;
  productId: number;
  purchaseUnitId: number | null;
  quantity: string;
  unitCost: string;
};
