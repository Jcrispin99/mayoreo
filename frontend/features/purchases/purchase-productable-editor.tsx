import { useEffect, useState } from 'react';
import { Button, Menu, Text, TextInput } from 'react-native-paper';
import { ProductableEditor } from '../../components/productables/productable-editor';
import { PurchaseTemplateVariantPicker } from './purchase-template-variant-picker';
import type { PurchaseProductableDraft } from './purchase-productable-types';
import type { Product } from './purchase-types';

type PurchaseProductableEditorProps = {
  initialItem: PurchaseProductableDraft | null;
  readOnly: boolean;
  visible: boolean;
  onClose: () => void;
  onDelete: (key: number) => void;
  onSave: (item: PurchaseProductableDraft) => void;
};

export function PurchaseProductableEditor({
  initialItem,
  readOnly,
  visible,
  onClose,
  onDelete,
  onSave,
}: PurchaseProductableEditorProps) {
  const [productId, setProductId] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [purchaseUnitId, setPurchaseUnitId] = useState<number | null>(null);
  const [purchaseUnitMenuVisible, setPurchaseUnitMenuVisible] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [productPickerVisible, setProductPickerVisible] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setProductId(null);
    setSelectedProduct(null);
    setPurchaseUnitId(null);
    setPurchaseUnitMenuVisible(false);
    setQuantity('1');
    setUnitCost('');
    setProductPickerVisible(false);
    setError('');
  }

  useEffect(() => {
    if (!visible) return;
    if (initialItem) {
      setProductId(initialItem.productId);
      setSelectedProduct(initialItem.product);
      setPurchaseUnitId(initialItem.purchaseUnitId);
      setPurchaseUnitMenuVisible(false);
      setQuantity(initialItem.quantity);
      setUnitCost(initialItem.unitCost);
      setProductPickerVisible(false);
      setError('');
    } else {
      reset();
    }
  }, [initialItem, visible]);

  const subtotal = (Number(quantity) || 0) * (Number(unitCost) || 0);
  const purchaseUnits = selectedProduct?.purchase_units ?? [];
  const purchaseUnit = purchaseUnits.find((unit) => unit.id === purchaseUnitId) ?? null;
  const variantUnitName = selectedProduct?.variant_name
    || selectedProduct?.base_unit?.name
    || selectedProduct?.base_unit?.code
    || 'unidad base';
  const selectedUnitName = purchaseUnit?.name ?? variantUnitName;

  function confirmProduct(product: Product) {
    setProductPickerVisible(false);
    setProductId(product.id);
    setSelectedProduct(product);
    setPurchaseUnitId(product.purchase_units?.find((unit) => unit.is_default_purchase)?.id ?? null);
    setPurchaseUnitMenuVisible(false);
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
      product: selectedProduct,
      purchaseUnitId,
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
    <>
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
        onSelectProduct={() => {}}
        onToggleProductPicker={() => setProductPickerVisible(true)}
        productPickerOpen={false}
        products={[]}
        readOnly={readOnly}
        selectedProductId={productId}
        selectedProductLabel={selectedProduct
          ? `${selectedProduct.display_name} · ${selectedProduct.sku}`
          : 'Seleccionar producto'}
        selectorLabel="Producto y variante *"
        summaryLabel="Subtotal de la línea"
        summaryValue={`S/ ${subtotal.toFixed(2)}`}
        title={readOnly
          ? 'Detalle de la línea'
          : initialItem
            ? 'Editar línea de la compra'
            : 'Crear línea de la compra'}
        visible={visible}
      >
        {selectedProduct ? (
          <>
            <Menu
              anchor={(
                <Button
                  contentStyle={{ justifyContent: 'space-between' }}
                  disabled={readOnly}
                  icon="chevron-down"
                  mode="outlined"
                  onPress={() => setPurchaseUnitMenuVisible(true)}
                >
                  Comprar por: {selectedUnitName}
                </Button>
              )}
              onDismiss={() => setPurchaseUnitMenuVisible(false)}
              visible={purchaseUnitMenuVisible}
            >
              <Menu.Item
                onPress={() => {
                  setPurchaseUnitId(null);
                  setPurchaseUnitMenuVisible(false);
                }}
                title={`Unidad base: ${variantUnitName}`}
              />
              {purchaseUnits.map((unit) => (
                <Menu.Item
                  key={unit.id}
                  onPress={() => {
                    setPurchaseUnitId(unit.id);
                    setPurchaseUnitMenuVisible(false);
                  }}
                  title={`${unit.name} = ${Number(unit.conversion_factor)} ${variantUnitName}`}
                />
              ))}
            </Menu>
            {purchaseUnit ? (
              <Text style={{ color: '#60706E', fontSize: 11 }}>
                Cada {purchaseUnit.name} ingresará {Number(purchaseUnit.conversion_factor)} {variantUnitName} al inventario.
              </Text>
            ) : null}
          </>
        ) : null}
        <TextInput
          editable={!readOnly}
          keyboardType="decimal-pad"
          label={`Cantidad (${selectedUnitName}) *`}
          mode="flat"
          onChangeText={setQuantity}
          style={{ backgroundColor: 'transparent' }}
          value={quantity}
        />
        <TextInput
          editable={!readOnly}
          keyboardType="decimal-pad"
          label={`Costo por ${selectedUnitName} *`}
          mode="flat"
          onChangeText={setUnitCost}
          style={{ backgroundColor: 'transparent' }}
          value={unitCost}
        />
      </ProductableEditor>
      <PurchaseTemplateVariantPicker
        onClose={() => setProductPickerVisible(false)}
        onConfirm={confirmProduct}
        selectedProductId={productId}
        visible={productPickerVisible}
      />
    </>
  );
}
