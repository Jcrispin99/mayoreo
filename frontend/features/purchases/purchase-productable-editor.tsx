import { useEffect, useState } from 'react';
import { TextInput } from 'react-native-paper';
import { ProductableEditor } from '../../components/productables/productable-editor';
import type { PurchaseProductableDraft } from './purchase-productable-types';
import type { Product } from './purchase-types';

type PurchaseProductableEditorProps = {
  initialItem: PurchaseProductableDraft | null;
  products: Product[];
  readOnly: boolean;
  visible: boolean;
  onClose: () => void;
  onDelete: (key: number) => void;
  onSave: (item: PurchaseProductableDraft) => void;
};

export function PurchaseProductableEditor({
  initialItem,
  products,
  readOnly,
  visible,
  onClose,
  onDelete,
  onSave,
}: PurchaseProductableEditorProps) {
  const [productId, setProductId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setProductId(null);
    setQuantity('1');
    setUnitCost('');
    setProductPickerOpen(false);
    setError('');
  }

  useEffect(() => {
    if (!visible) return;
    if (initialItem) {
      setProductId(initialItem.productId);
      setQuantity(initialItem.quantity);
      setUnitCost(initialItem.unitCost);
      setProductPickerOpen(false);
      setError('');
    } else {
      reset();
    }
  }, [initialItem, visible]);

  const selectedProduct = products.find((product) => product.id === productId);
  const subtotal = (Number(quantity) || 0) * (Number(unitCost) || 0);

  function selectProduct(product: Product) {
    setProductPickerOpen(false);
    setProductId(product.id);
    setError('');
  }

  function buildItem(): PurchaseProductableDraft | null {
    if (!productId || Number(quantity) <= 0 || Number(unitCost) <= 0) {
      setError('Selecciona un producto e ingresa una cantidad y costo mayores a cero.');
      return null;
    }
    return {
      key: initialItem?.key ?? 0,
      productId,
      purchaseUnitId: initialItem?.productId === productId ? initialItem.purchaseUnitId : null,
      quantity,
      unitCost,
    };
  }

  function saveAndClose() {
    const item = buildItem();
    if (!item) return;
    onSave(item);
    onClose();
  }

  function saveAndCreateAnother() {
    const item = buildItem();
    if (!item) return;
    onSave(item);
    reset();
  }

  return (
    <ProductableEditor
      backAccessibilityLabel="Volver a la compra"
      error={error}
      onClose={onClose}
      onDelete={initialItem ? () => {
        onDelete(initialItem.key);
        onClose();
      } : undefined}
      onSave={saveAndClose}
      onSaveAndCreateAnother={saveAndCreateAnother}
      onSelectProduct={(picked) => {
        const product = products.find((candidate) => candidate.id === picked.id);
        if (product) selectProduct(product);
      }}
      onToggleProductPicker={() => setProductPickerOpen((current) => !current)}
      productPickerOpen={productPickerOpen}
      products={products}
      readOnly={readOnly}
      selectedProductId={productId}
      selectedProductLabel={selectedProduct
        ? `${selectedProduct.name} · ${selectedProduct.sku}`
        : 'Seleccionar variante'}
      summaryLabel="Subtotal de la línea"
      summaryValue={`S/ ${subtotal.toFixed(2)}`}
      title={readOnly
        ? 'Detalle de la línea'
        : initialItem
          ? 'Editar línea de la compra'
          : 'Crear línea de la compra'}
      visible={visible}
    >
      <TextInput
        editable={!readOnly}
        keyboardType="decimal-pad"
        label="Cantidad de la variante *"
        mode="flat"
        onChangeText={setQuantity}
        style={{ backgroundColor: 'transparent' }}
        value={quantity}
      />
      <TextInput
        editable={!readOnly}
        keyboardType="decimal-pad"
        label="Costo unitario de la variante *"
        mode="flat"
        onChangeText={setUnitCost}
        style={{ backgroundColor: 'transparent' }}
        value={unitCost}
      />
    </ProductableEditor>
  );
}
