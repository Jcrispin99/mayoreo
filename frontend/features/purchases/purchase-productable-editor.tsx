import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Icon, Menu, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import type { PurchaseProductableDraft } from './purchase-productable-types';
import type { Product, PurchaseUnit } from './purchase-types';

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
  const [purchaseUnitId, setPurchaseUnitId] = useState<number | null>(null);
  const [purchaseUnits, setPurchaseUnits] = useState<PurchaseUnit[]>([]);
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [productMenuVisible, setProductMenuVisible] = useState(false);
  const [unitMenuVisible, setUnitMenuVisible] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setProductId(null);
    setPurchaseUnitId(null);
    setPurchaseUnits([]);
    setQuantity('1');
    setUnitCost('');
    setError('');
  }

  useEffect(() => {
    if (!visible) return;
    if (initialItem) {
      setProductId(initialItem.productId);
      setPurchaseUnitId(initialItem.purchaseUnitId);
      setPurchaseUnits(initialItem.purchaseUnits);
      setQuantity(initialItem.quantity);
      setUnitCost(initialItem.unitCost);
      setError('');
    } else {
      reset();
    }
  }, [initialItem, visible]);

  const selectedProduct = products.find((product) => product.id === productId);
  const selectedUnit = purchaseUnits.find((unit) => unit.id === purchaseUnitId);
  const subtotal = (Number(quantity) || 0) * (Number(unitCost) || 0);

  async function selectProduct(product: Product) {
    setProductMenuVisible(false);
    setProductId(product.id);
    setPurchaseUnitId(null);
    setPurchaseUnits([]);
    setError('');
    try {
      const response = await api.get(`/products/${product.id}`);
      const units: PurchaseUnit[] = response.data.data?.purchase_units ?? [];
      const defaultUnit = units.find((unit) => unit.is_default_purchase) ?? units[0];
      setPurchaseUnits(units);
      setPurchaseUnitId(defaultUnit?.id ?? null);
    } catch {
      setError(`No se pudieron cargar las presentaciones de ${product.name}.`);
    }
  }

  function buildItem(): PurchaseProductableDraft | null {
    if (!productId || Number(quantity) <= 0 || Number(unitCost) <= 0) {
      setError('Selecciona un producto e ingresa una cantidad y costo mayores a cero.');
      return null;
    }
    return {
      key: initialItem?.key ?? 0,
      productId,
      purchaseUnitId,
      purchaseUnits,
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
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
          <View style={styles.header}>
            <Pressable accessibilityLabel="Volver a la compra" hitSlop={8} onPress={onClose} style={styles.backButton}>
              <Icon source="arrow-left" color="#172423" size={22} />
            </Pressable>
            <Text style={styles.headerTitle}>{readOnly ? 'Detalle de la línea' : initialItem ? 'Editar línea de la compra' : 'Crear línea de la compra'}</Text>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Text style={styles.label}>Producto *</Text>
            <Menu
              anchor={
                <Pressable disabled={readOnly} onPress={() => setProductMenuVisible(true)} style={[styles.selector, readOnly && styles.disabled]}>
                  <Text numberOfLines={1} style={styles.selectorText}>
                    {selectedProduct ? `${selectedProduct.name} · ${selectedProduct.sku}` : 'Seleccionar producto'}
                  </Text>
                  {!readOnly ? <Icon source="chevron-down" color="#B4232D" size={20} /> : null}
                </Pressable>
              }
              onDismiss={() => setProductMenuVisible(false)}
              visible={productMenuVisible}
            >
              {products.map((product) => (
                <Menu.Item key={product.id} onPress={() => void selectProduct(product)} title={`${product.name} · ${product.sku}`} />
              ))}
            </Menu>

            {selectedProduct ? (
              <>
                <Text style={styles.label}>Presentación de compra</Text>
                <Menu
                  anchor={
                    <Pressable disabled={readOnly} onPress={() => setUnitMenuVisible(true)} style={[styles.selector, readOnly && styles.disabled]}>
                      <Text style={styles.selectorText}>{selectedUnit?.name ?? selectedProduct.base_unit?.name ?? 'Unidad base'}</Text>
                      {!readOnly ? <Icon source="chevron-down" color="#B4232D" size={20} /> : null}
                    </Pressable>
                  }
                  onDismiss={() => setUnitMenuVisible(false)}
                  visible={unitMenuVisible}
                >
                  <Menu.Item onPress={() => { setPurchaseUnitId(null); setUnitMenuVisible(false); }} title={selectedProduct.base_unit?.name ?? 'Unidad base'} />
                  {purchaseUnits.map((unit) => (
                    <Menu.Item key={unit.id} onPress={() => { setPurchaseUnitId(unit.id); setUnitMenuVisible(false); }} title={unit.name} />
                  ))}
                </Menu>
              </>
            ) : null}

            <TextInput editable={!readOnly} keyboardType="decimal-pad" label="Cantidad *" mode="flat" onChangeText={setQuantity} style={styles.input} value={quantity} />
            <TextInput editable={!readOnly} keyboardType="decimal-pad" label="Costo unitario *" mode="flat" onChangeText={setUnitCost} style={styles.input} value={unitCost} />

            <View style={styles.summary}>
              <Text style={styles.summaryLabel}>Subtotal de la línea</Text>
              <Text style={styles.summaryValue}>S/ {subtotal.toFixed(2)}</Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            {readOnly ? (
              <Button mode="contained" onPress={onClose}>Cerrar</Button>
            ) : (
              <>
                <View style={styles.primaryActions}>
                  <Button buttonColor="#FF4D4D" mode="contained" onPress={saveAndClose} style={styles.primaryButton}>Guardar y cerrar</Button>
                  <Button buttonColor="#FF4D4D" mode="contained" onPress={saveAndCreateAnother} style={styles.primaryButton}>Guardar y crear nuevo</Button>
                </View>
                <Button buttonColor="#2DD4BF" mode="contained" onPress={onClose} textColor="#073B35">Descartar</Button>
                {initialItem ? <Button mode="text" onPress={() => { onDelete(initialItem.key); onClose(); }} textColor="#8F1D2C">Eliminar línea</Button> : null}
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  screen: { flex: 1 },
  header: { minHeight: 56, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#DCDDE0' },
  backButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { marginLeft: 4, color: '#172423', fontSize: 16, fontWeight: '800' },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 14, paddingTop: 28, gap: 20, paddingBottom: 40 },
  error: { padding: 12, borderRadius: 8, color: '#8F1D2C', backgroundColor: '#FCE8EA' },
  label: { marginBottom: -16, color: '#172423', fontSize: 14, fontWeight: '700' },
  selector: { minHeight: 48, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#B4232D' },
  selectorText: { flex: 1, color: '#303A49', fontSize: 14 },
  disabled: { opacity: 0.72 },
  input: { backgroundColor: 'transparent' },
  summary: { marginTop: 10, padding: 15, flexDirection: 'row', justifyContent: 'space-between', borderRadius: 8, backgroundColor: '#EAEFEE' },
  summaryLabel: { color: '#5D5661', fontSize: 13, fontWeight: '700' },
  summaryValue: { color: '#B4232D', fontSize: 16, fontWeight: '900' },
  footer: { padding: 14, gap: 10, borderTopWidth: 1, borderTopColor: '#DCDDE0', backgroundColor: '#FFFFFF' },
  primaryActions: { flexDirection: 'row', gap: 12 },
  primaryButton: { flex: 1 },
});
