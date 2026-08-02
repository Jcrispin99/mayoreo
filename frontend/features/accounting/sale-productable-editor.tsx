import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { ProductableEditor } from '../../components/productables/productable-editor';
import type { UnitOfMeasure } from '../inventory/inventory-types';
import type {
  AccountingProduct,
  AccountingSaleDraftLine,
} from './accounting-types';
import {
  saleLinePreview,
  saleUnitsForProduct,
} from './sale-productable-pricing';

type SaleProductableEditorProps = {
  initialItem: AccountingSaleDraftLine | null;
  products: AccountingProduct[];
  unavailableProductIds: Set<number | null>;
  units: UnitOfMeasure[];
  visible: boolean;
  onClose: () => void;
  onDelete: (key: number) => void;
  onSave: (item: AccountingSaleDraftLine) => void;
};

function money(value: string | number) {
  return `S/ ${Number(value).toFixed(2)}`;
}

export function SaleProductableEditor({
  initialItem,
  products,
  unavailableProductIds,
  units,
  visible,
  onClose,
  onDelete,
  onSave,
}: SaleProductableEditorProps) {
  const [productId, setProductId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [unitCode, setUnitCode] = useState('');
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setProductId(null);
    setQuantity('1');
    setUnitCode('');
    setProductPickerOpen(false);
    setError('');
  }

  useEffect(() => {
    if (!visible) return;
    if (initialItem) {
      setProductId(initialItem.productId);
      setQuantity(initialItem.quantity);
      setUnitCode(initialItem.unitCode);
      setProductPickerOpen(false);
      setError('');
    } else {
      reset();
    }
  }, [initialItem, visible]);

  const selectedProduct = products.find((product) => product.id === productId);
  const unitOptions = saleUnitsForProduct(selectedProduct, units);
  const preview = saleLinePreview({
    key: initialItem?.key ?? 0,
    productId,
    quantity,
    unitCode,
  }, products);
  const availableProducts = useMemo(
    () => products.filter((product) => (
      product.id === productId || !unavailableProductIds.has(product.id)
    )),
    [productId, products, unavailableProductIds],
  );

  function selectProduct(product: AccountingProduct) {
    setProductId(product.id);
    setUnitCode(product.base_unit?.code ?? '');
    setProductPickerOpen(false);
    setError('');
  }

  function buildItem(): AccountingSaleDraftLine | null {
    if (!productId || !unitCode || Number(quantity) <= 0 || !preview) {
      setError('Selecciona una variante, cantidad y unidad con un precio disponible.');
      return null;
    }

    return {
      key: initialItem?.key ?? 0,
      productId,
      quantity,
      unitCode,
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
      backAccessibilityLabel="Volver a la venta"
      error={error}
      onClose={onClose}
      onDelete={initialItem ? () => {
        onDelete(initialItem.key);
        onClose();
      } : undefined}
      onSave={saveAndClose}
      onSaveAndCreateAnother={saveAndCreateAnother}
      onSelectProduct={(picked) => {
        const product = availableProducts.find((candidate) => candidate.id === picked.id);
        if (product) selectProduct(product);
      }}
      onToggleProductPicker={() => setProductPickerOpen((current) => !current)}
      productPickerOpen={productPickerOpen}
      products={availableProducts}
      selectedProductId={productId}
      selectedProductLabel={selectedProduct
        ? `${selectedProduct.name} · ${selectedProduct.sku}`
        : 'Seleccionar variante'}
      summaryDetail={preview
        ? `${preview.tier.label ?? 'Precio'} · ${money(preview.tier.unit_price)} / ${selectedProduct?.base_unit?.code ?? 'unidad'}`
        : 'No hay un precio para esta cantidad.'}
      summaryLabel="Subtotal de la línea"
      summaryValue={preview ? money(preview.total) : '—'}
      title={initialItem ? 'Editar línea de la venta' : 'Crear línea de la venta'}
      visible={visible}
    >
      <TextInput
        keyboardType="decimal-pad"
        label="Cantidad de la variante *"
        mode="flat"
        onChangeText={setQuantity}
        style={styles.input}
        value={quantity}
      />

      <View style={styles.unitSection}>
        <Text style={styles.unitLabel}>Unidad *</Text>
        <View style={styles.unitOptions}>
          {unitOptions.map((unit) => {
            const selected = unit.code === unitCode;
            return (
              <Pressable
                accessibilityLabel={`Usar ${unit.name}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={unit.id}
                onPress={() => {
                  setUnitCode(unit.code);
                  setError('');
                }}
                style={[styles.unitOption, selected && styles.unitOptionSelected]}
              >
                <Text style={[styles.unitOptionText, selected && styles.unitOptionTextSelected]}>
                  {unit.name} ({unit.code})
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ProductableEditor>
  );
}

const styles = StyleSheet.create({
  input: { backgroundColor: 'transparent' },
  unitSection: { gap: 9 },
  unitLabel: { color: '#172423', fontSize: 14, fontWeight: '700' },
  unitOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  unitOption: { paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: '#BCD6CC', borderRadius: 9, backgroundColor: '#F2F8F6' },
  unitOptionSelected: { borderColor: '#B4232D', backgroundColor: '#B4232D' },
  unitOptionText: { color: '#315E51', fontSize: 11, fontWeight: '800' },
  unitOptionTextSelected: { color: '#FFFFFF' },
});
