import { ProductableLines } from '../../components/productables/productable-lines';
import type { PurchaseProductableDraft } from './purchase-productable-types';

type PurchaseProductableLinesProps = {
  items: PurchaseProductableDraft[];
  readOnly: boolean;
  onAdd: () => void;
  onOpen: (item: PurchaseProductableDraft) => void;
};

export function PurchaseProductableLines({
  items,
  readOnly,
  onAdd,
  onOpen,
}: PurchaseProductableLinesProps) {
  const lines = items.map((item) => {
    const product = item.product;
    const purchaseUnit = product?.purchase_units?.find((unit) => unit.id === item.purchaseUnitId);
    const unitName = purchaseUnit?.name ?? product?.variant_name ?? product?.base_unit?.code ?? product?.base_unit?.name ?? 'un.';
    const subtotal = (Number(item.quantity) || 0) * (Number(item.unitCost) || 0);

    return {
      key: item.key,
      productName: product?.display_name ?? `Producto #${item.productId}`,
      sku: product?.sku,
      details: [
        `Cantidad: ${Number(item.quantity).toFixed(2)} ${unitName}`,
        `Costo unitario: S/ ${Number(item.unitCost).toFixed(2)}`,
      ],
      subtotal,
    };
  });

  return (
    <ProductableLines
      emptyText="Presiona “Agregar” para seleccionar la primera variante de la compra."
      emptyTitle="Aún no hay variantes"
      lines={lines}
      onAdd={onAdd}
      onOpen={(key) => {
        const item = items.find((candidate) => candidate.key === key);
        if (item) onOpen(item);
      }}
      readOnly={readOnly}
    />
  );
}
