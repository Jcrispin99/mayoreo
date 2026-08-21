import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';
import { ModuleLayout } from '../../components/module/module-layout';
import { ProductableEditor } from '../../components/productables/productable-editor';
import { ProductableLines } from '../../components/productables/productable-lines';
import { getVisibleMenu } from '../../config/menu';
import { api, apiErrorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import type { InventoryTransfer, Warehouse } from './inventory-types';

type Product = {
  id: number;
  sku: string;
  name: string;
  is_active: boolean;
  base_unit?: { id: number; code: string; name: string } | null;
};

type TransferLine = {
  key: number;
  productId: number;
  quantity: string;
};

type InventoryTransferFormProps = {
  transferId?: string;
};

const TRANSFERS_MODULE = getVisibleMenu().find((module) => module.id === 'transfers');

const STATUS_COPY = {
  draft: 'Este traslado todavía no modificó el stock.',
  in_transit: 'El stock ya salió del almacén principal y espera recepción en el almacén medio.',
  received: 'El stock fue recibido y ya está disponible en el almacén medio.',
  cancelled: 'Este traslado fue cancelado.',
} as const;

function requestErrorMessage(requestError: any, fallback: string) {
  const validationErrors = requestError?.response?.data?.errors;
  const firstValidationError = validationErrors ? Object.values(validationErrors).flat()[0] : null;
  return typeof firstValidationError === 'string'
    ? firstValidationError
    : requestError?.response?.data?.message ?? fallback;
}

function quantityLabel(quantity: string, product?: Product) {
  const unit = product?.base_unit?.code ?? product?.base_unit?.name ?? 'un.';
  return `${Number(quantity || 0).toFixed(2)} ${unit}`;
}

type TransferLineEditorProps = {
  initialLine: TransferLine | null;
  products: Product[];
  visible: boolean;
  onClose: () => void;
  onDelete: (key: number) => void;
  onSave: (line: TransferLine) => void;
};

function TransferLineEditor({ initialLine, products, visible, onClose, onDelete, onSave }: TransferLineEditorProps) {
  const [productId, setProductId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setProductId(initialLine?.productId ?? null);
    setQuantity(initialLine?.quantity ?? '1');
    setProductPickerOpen(false);
    setError('');
  }, [initialLine, visible]);

  const selectedProduct = products.find((product) => product.id === productId);

  function buildLine(): TransferLine | null {
    if (!productId || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
      setError('Selecciona una variante e ingresa una cantidad mayor a cero.');
      return null;
    }

    return { key: initialLine?.key ?? 0, productId, quantity: quantity.trim() };
  }

  function saveAndClose() {
    const line = buildLine();
    if (!line) return;
    onSave(line);
    onClose();
  }

  function saveAndCreateAnother() {
    const line = buildLine();
    if (!line) return;
    onSave(line);
    setProductId(null);
    setQuantity('1');
    setProductPickerOpen(false);
  }

  return (
    <ProductableEditor
      backAccessibilityLabel="Volver al traslado"
      error={error}
      onClose={onClose}
      onDelete={initialLine ? () => { onDelete(initialLine.key); onClose(); } : undefined}
      onSave={saveAndClose}
      onSaveAndCreateAnother={saveAndCreateAnother}
      onSelectProduct={(product) => { setProductId(product.id); setProductPickerOpen(false); setError(''); }}
      onToggleProductPicker={() => setProductPickerOpen((current) => !current)}
      productPickerOpen={productPickerOpen}
      products={products}
      selectedProductId={productId}
      selectedProductLabel={selectedProduct ? `${selectedProduct.name} · ${selectedProduct.sku}` : 'Seleccionar variante'}
      summaryLabel="Cantidad a trasladar"
      summaryValue={quantityLabel(quantity, selectedProduct)}
      title={initialLine ? 'Editar variante' : 'Agregar variante'}
      visible={visible}
    >
      <TextInput
        keyboardType="decimal-pad"
        label="Cantidad *"
        mode="flat"
        onChangeText={setQuantity}
        style={styles.lineInput}
        value={quantity}
      />
    </ProductableEditor>
  );
}

export function InventoryTransferForm({ transferId }: InventoryTransferFormProps) {
  const { user } = useAuth();
  const editing = Boolean(transferId);
  const [transfer, setTransfer] = useState<InventoryTransfer | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [fromWarehouseId, setFromWarehouseId] = useState<number | null>(null);
  const [toWarehouseId, setToWarehouseId] = useState<number | null>(null);
  const [items, setItems] = useState<TransferLine[]>([]);
  const [notes, setNotes] = useState('');
  const [selectedLine, setSelectedLine] = useState<TransferLine | null>(null);
  const [lineEditorVisible, setLineEditorVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [confirmingAction, setConfirmingAction] = useState<'dispatch' | 'receive' | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [transferResponse, warehousesResponse, productsResponse] = await Promise.all([
        transferId ? api.get(`/inventory-transfers/${transferId}`) : Promise.resolve(null),
        api.get('/warehouses'),
        api.get('/products'),
      ]);
      const loadedTransfer: InventoryTransfer | null = transferResponse?.data.data ?? null;
      const loadedWarehouses: Warehouse[] = warehousesResponse.data.data ?? [];
      const loadedProducts: Product[] = (productsResponse.data.data ?? []).filter((product: Product) => product.is_active);

      setTransfer(loadedTransfer);
      setWarehouses(loadedWarehouses);
      setProducts(loadedProducts);

      if (loadedTransfer) {
        setFromWarehouseId(loadedTransfer.from_warehouse_id);
        setToWarehouseId(loadedTransfer.to_warehouse_id);
        setItems(loadedTransfer.items.map((item, index) => ({
          key: index + 1,
          productId: item.product_id,
          quantity: String(item.quantity),
        })));
        setNotes(loadedTransfer.notes ?? '');
      } else {
        setFromWarehouseId(loadedWarehouses.find((warehouse) => warehouse.type === 'main' && warehouse.is_active)?.id ?? null);
        setToWarehouseId(loadedWarehouses.find((warehouse) => warehouse.type === 'retail' && warehouse.is_active)?.id ?? null);
        setItems([]);
        setNotes('');
      }
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'No se pudo cargar el traslado.'));
    } finally {
      setLoading(false);
    }
  }, [transferId]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const fromWarehouse = warehouses.find((warehouse) => warehouse.id === fromWarehouseId);
  const toWarehouse = warehouses.find((warehouse) => warehouse.id === toWarehouseId);
  const canCreate = !editing && fromWarehouse?.type === 'main' && toWarehouse?.type === 'retail';
  const canManage = user !== null && (!user.permissions || user.permissions.includes('inventory-transfers.manage'));
  const currentStatus = transfer?.status;

  function openNewLine() {
    setSelectedLine(null);
    setLineEditorVisible(true);
  }

  function saveLine(line: TransferLine) {
    if (line.key > 0) {
      setItems((current) => current.map((currentLine) => currentLine.key === line.key ? line : currentLine));
      return;
    }
    setItems((current) => [...current, { ...line, key: Math.max(0, ...current.map((currentLine) => currentLine.key)) + 1 }]);
  }

  function removeLine(key: number) {
    setItems((current) => current.filter((item) => item.key !== key));
  }

  async function createTransfer() {
    if (!fromWarehouseId || !toWarehouseId || items.length === 0) {
      setError('Agrega al menos una variante y verifica los almacenes de origen y destino.');
      return;
    }
    if (!canCreate) {
      setError('Se necesita un almacén Principal y un almacén Medio activos para crear este traslado.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const response = await api.post('/inventory-transfers', {
        from_warehouse_id: fromWarehouseId,
        to_warehouse_id: toWarehouseId,
        notes: notes.trim() || null,
        items: items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
      });
      router.replace({ pathname: '/transfers/[transferId]', params: { transferId: String(response.data.data.id) } } as Href);
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'No se pudo crear el traslado.'));
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action: 'dispatch' | 'receive') {
    if (!transfer) return;
    setActing(true);
    setError('');
    try {
      await api.post(`/inventory-transfers/${transfer.id}/${action}`);
      setConfirmingAction(null);
      await load();
    } catch (requestError) {
      setError(requestErrorMessage(requestError, action === 'dispatch' ? 'No se pudo despachar el traslado.' : 'No se pudo recibir el traslado.'));
      setConfirmingAction(null);
    } finally {
      setActing(false);
    }
  }

  if (!TRANSFERS_MODULE) return null;

  return (
    <ModuleLayout module={TRANSFERS_MODULE} selectedItemId="transfer-list">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        {loading ? <ActivityIndicator color="#0F766E" size="large" style={styles.loader} /> : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Button compact icon="arrow-left" mode="text" onPress={() => router.back()}>Volver</Button>
              {!editing && canManage ? <Button buttonColor="#FF4D4D" disabled={saving} loading={saving} mode="contained" onPress={() => void createTransfer()}>Crear borrador</Button> : null}
            </View>

            <Text style={styles.title}>{editing ? `Traslado #${transfer?.id ?? ''}` : 'Nuevo traslado'}</Text>
            <Text style={styles.subtitle}>{editing && currentStatus ? STATUS_COPY[currentStatus] : 'El borrador no modifica el inventario hasta que se despache desde el almacén principal.'}</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.routeCard}>
              <View style={styles.routeBlock}><Text style={styles.routeLabel}>Origen</Text><Text style={styles.routeValue}>{fromWarehouse?.name ?? 'Almacén principal no disponible'}</Text><Text style={styles.routeCode}>{fromWarehouse?.code ?? 'MAIN'}</Text></View>
              <Text style={styles.routeArrow}>→</Text>
              <View style={styles.routeBlock}><Text style={styles.routeLabel}>Destino</Text><Text style={styles.routeValue}>{toWarehouse?.name ?? 'Almacén medio no disponible'}</Text><Text style={styles.routeCode}>{toWarehouse?.code ?? 'RETAIL'}</Text></View>
            </View>

            {confirmingAction ? (
              <View style={styles.confirmation}>
                <Text style={styles.confirmationTitle}>{confirmingAction === 'dispatch' ? '¿Despachar traslado?' : '¿Confirmar recepción?'}</Text>
                <Text style={styles.confirmationText}>{confirmingAction === 'dispatch'
                  ? 'El stock se descontará del almacén principal y el traslado quedará en tránsito.'
                  : 'El stock ingresará al almacén medio con el costo del despacho.'}</Text>
                <View style={styles.confirmationActions}>
                  <Button disabled={acting} onPress={() => setConfirmingAction(null)}>Cancelar</Button>
                  <Button buttonColor={confirmingAction === 'dispatch' ? '#0F766E' : '#247451'} loading={acting} mode="contained" onPress={() => void runAction(confirmingAction)}>
                    {confirmingAction === 'dispatch' ? 'Despachar' : 'Recibir'}
                  </Button>
                </View>
              </View>
            ) : currentStatus === 'draft' && canManage ? (
              <Button buttonColor="#0F766E" icon="truck-fast-outline" mode="contained" onPress={() => setConfirmingAction('dispatch')}>Despachar desde principal</Button>
            ) : currentStatus === 'in_transit' && canManage ? (
              <Button buttonColor="#247451" icon="package-variant-closed-check" mode="contained" onPress={() => setConfirmingAction('receive')}>Confirmar recepción en medio</Button>
            ) : null}

            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Variantes</Text></View>
            <ProductableLines
              emptyText="Presiona “Agregar” para seleccionar las variantes y cantidades que se enviarán al almacén medio."
              emptyTitle="Aún no hay variantes"
              lines={items.map((item) => {
                const product = products.find((candidate) => candidate.id === item.productId);
                return {
                  key: item.key,
                  productName: product?.name ?? `Variante #${item.productId}`,
                  sku: product?.sku,
                  details: [`Cantidad a trasladar: ${quantityLabel(item.quantity, product)}`],
                  subtotal: null,
                };
              })}
              onAdd={openNewLine}
              onOpen={(key) => {
                const item = items.find((candidate) => candidate.key === key);
                if (item) {
                  setSelectedLine(item);
                  setLineEditorVisible(true);
                }
              }}
              readOnly={editing || !canManage}
              showTotal={false}
            />

            <TextInput editable={!editing && canManage} label="Observación" mode="outlined" multiline onChangeText={setNotes} placeholder="Opcional" value={notes} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      <TransferLineEditor
        initialLine={selectedLine}
        onClose={() => setLineEditorVisible(false)}
        onDelete={removeLine}
        onSave={saveLine}
        products={products}
        visible={lineEditorVisible}
      />
    </ModuleLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' },
  loader: { flex: 1 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingBottom: 48, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { color: '#172423', fontSize: 23, fontWeight: '900' },
  subtitle: { marginTop: -10, color: '#60706E', fontSize: 12, lineHeight: 18 },
  error: { padding: 12, borderRadius: 8, color: '#8F1D2C', backgroundColor: '#FCE8EA', fontSize: 12 },
  routeCard: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#B6D5D0', borderRadius: 8, backgroundColor: '#EAF7F4' },
  routeBlock: { flex: 1 },
  routeLabel: { color: '#60706E', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  routeValue: { marginTop: 3, color: '#172423', fontSize: 14, fontWeight: '800' },
  routeCode: { marginTop: 3, color: '#0F766E', fontSize: 10, fontWeight: '800' },
  routeArrow: { color: '#0F766E', fontSize: 22, fontWeight: '800' },
  confirmation: { padding: 16, gap: 10, borderWidth: 1, borderColor: '#F1C772', borderRadius: 8, backgroundColor: '#FFF8E8' },
  confirmationTitle: { color: '#172423', fontSize: 15, fontWeight: '900' },
  confirmationText: { color: '#60706E', fontSize: 12, lineHeight: 17 },
  confirmationActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#172423', fontSize: 16, fontWeight: '900' },
  lineInput: { backgroundColor: 'transparent' },
});