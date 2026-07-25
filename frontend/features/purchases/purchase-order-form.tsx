import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Icon, Menu, Text, TextInput } from 'react-native-paper';
import { ModuleLayout } from '../../components/module/module-layout';
import { getVisibleMenu } from '../../config/menu';
import { api } from '../../lib/api';
import { ProductableLines } from './productable-lines';
import { PurchaseProductableEditor } from './purchase-productable-editor';
import type { PurchaseProductableDraft } from './purchase-productable-types';
import type { Product, PurchaseOrder, PurchaseUnit, Supplier, Warehouse } from './purchase-types';

type PurchaseOrderFormProps = {
  purchaseId?: string;
};

type OpenMenu = { type: 'supplier' | 'warehouse' } | null;

const PURCHASES_MODULE = getVisibleMenu().find((module) => module.id === 'purchases');

function localDate() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function requestErrorMessage(error: any) {
  const validationErrors = error?.response?.data?.errors;
  const firstValidationError = validationErrors ? Object.values(validationErrors).flat()[0] : null;
  if (typeof firstValidationError === 'string') return firstValidationError;
  return error?.response?.data?.message ?? 'No se pudo guardar la compra.';
}

export function PurchaseOrderForm({ purchaseId }: PurchaseOrderFormProps) {
  const editing = Boolean(purchaseId);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [orderedAt, setOrderedAt] = useState(localDate());
  const [invoiceSeries, setInvoiceSeries] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<PurchaseOrder['status']>('draft');
  const [fullNumber, setFullNumber] = useState<string | null>(null);
  const [items, setItems] = useState<PurchaseProductableDraft[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [lineEditorVisible, setLineEditorVisible] = useState(false);
  const [selectedLine, setSelectedLine] = useState<PurchaseProductableDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadForm() {
      try {
        const [orderResponse, suppliersResponse, warehousesResponse, productsResponse] = await Promise.all([
          purchaseId ? api.get(`/purchase-orders/${purchaseId}`) : Promise.resolve(null),
          api.get('/suppliers'),
          api.get('/warehouses'),
          api.get('/products'),
        ]);
        const order: PurchaseOrder | null = orderResponse?.data.data ?? null;
        const existingProductIds = new Set(order?.items.map((item) => item.product_id) ?? []);
        const availableSuppliers: Supplier[] = (suppliersResponse.data.data ?? []).filter(
          (supplier: Supplier) => supplier.is_active || supplier.id === order?.supplier_id,
        );
        const validWarehouses: Warehouse[] = (warehousesResponse.data.data ?? []).filter(
          (warehouse: Warehouse) => warehouse.type !== 'pos' && (warehouse.is_active || warehouse.id === order?.warehouse_id),
        );
        const availableProducts: Product[] = (productsResponse.data.data ?? []).filter(
          (product: Product) => product.is_active || existingProductIds.has(product.id),
        );

        setSuppliers(availableSuppliers);
        setWarehouses(validWarehouses);
        setProducts(availableProducts);

        if (order) {
          const uniqueProductIds = [...existingProductIds];
          const productResponses = await Promise.all(uniqueProductIds.map((productId) => api.get(`/products/${productId}`)));
          const unitsByProduct = new Map<number, PurchaseUnit[]>(productResponses.map((response) => [
            Number(response.data.data.id),
            response.data.data.purchase_units ?? [],
          ]));
          const loadedItems: PurchaseProductableDraft[] = order.items.map((item, index) => ({
            key: index + 1,
            productId: item.product_id,
            purchaseUnitId: item.product_purchase_unit_id,
            purchaseUnits: unitsByProduct.get(item.product_id) ?? [],
            quantity: String(item.quantity_purchased),
            unitCost: String(item.unit_cost),
          }));

          setSupplierId(order.supplier_id);
          setWarehouseId(order.warehouse_id);
          setOrderedAt(order.ordered_at);
          setInvoiceSeries(order.invoice_series ?? '');
          setInvoiceNumber(order.invoice_number ?? '');
          setNotes(order.notes ?? '');
          setStatus(order.status);
          setFullNumber(order.full_number);
          setItems(loadedItems);
          setNextKey(loadedItems.length + 1);
        } else {
          setSupplierId(availableSuppliers[0]?.id ?? null);
          setWarehouseId(validWarehouses[0]?.id ?? null);
        }
      } catch (requestError) {
        setError(requestErrorMessage(requestError));
      } finally {
        setLoading(false);
      }
    }

    void loadForm();
  }, [purchaseId]);

  const readOnly = editing && status !== 'draft';

  const selectedSupplier = suppliers.find((supplier) => supplier.id === supplierId);
  const selectedWarehouse = warehouses.find((warehouse) => warehouse.id === warehouseId);
  function openNewLine() {
    setSelectedLine(null);
    setLineEditorVisible(true);
  }

  function openLine(item: PurchaseProductableDraft) {
    setSelectedLine(item);
    setLineEditorVisible(true);
  }

  function saveLine(item: PurchaseProductableDraft) {
    if (item.key > 0) {
      setItems((current) => current.map((currentItem) => currentItem.key === item.key ? item : currentItem));
      setSelectedLine(null);
      return;
    }

    setItems((current) => [...current, { ...item, key: nextKey }]);
    setNextKey((current) => current + 1);
    setSelectedLine(null);
  }

  function removeLine(key: number) {
    setItems((current) => current.filter((item) => item.key !== key));
  }

  async function save() {
    const incompleteItem = items.some((item) => !item.productId || Number(item.quantity) <= 0 || Number(item.unitCost) <= 0);
    if (items.length === 0 || incompleteItem) {
      setError('Agrega al menos un producto con cantidad y costo válidos.');
      return;
    }
    if (!supplierId || !warehouseId || !orderedAt.trim()) {
      setError('Completa el proveedor, almacén y fecha de la compra.');
      return;
    }
    if (Boolean(invoiceSeries.trim()) !== Boolean(invoiceNumber.trim())) {
      setError('Completa tanto la serie como el correlativo de la factura, o deja ambos vacíos.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        supplier_id: supplierId,
        warehouse_id: warehouseId,
        ordered_at: orderedAt.trim(),
        invoice_series: invoiceSeries.trim().toUpperCase() || null,
        invoice_number: invoiceNumber.trim() || null,
        notes: notes.trim() || null,
        items: items.map((item) => ({
          product_id: item.productId,
          product_purchase_unit_id: item.purchaseUnitId,
          quantity_purchased: Number(item.quantity),
          unit_cost: Number(item.unitCost),
        })),
      };
      if (editing) {
        await api.put(`/purchase-orders/${purchaseId}`, payload);
      } else {
        await api.post('/purchase-orders', payload);
      }
      router.back();
    } catch (requestError) {
      setError(requestErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  if (!PURCHASES_MODULE) return null;

  return (
    <ModuleLayout module={PURCHASES_MODULE} selectedItemId="purchase-orders">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        {loading ? <ActivityIndicator color="#B4232D" size="large" style={styles.loader} /> : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Button compact icon="arrow-left" mode="text" onPress={() => router.back()}>Volver</Button>
              {!readOnly ? (
                <Button buttonColor="#FF4D4D" disabled={saving} loading={saving} mode="contained" onPress={() => void save()}>
                  {editing ? 'Guardar cambios' : 'Guardar borrador'}
                </Button>
              ) : null}
            </View>

            <Text style={styles.title}>{editing ? fullNumber ?? 'Detalle de compra' : 'Nueva compra'}</Text>
            <Text style={styles.subtitle}>
              {readOnly
                ? 'Esta compra está confirmada y se muestra en modo consulta porque ya afectó el inventario.'
                : editing
                  ? 'Puedes actualizar los datos y productos mientras la compra permanezca en borrador.'
                  : 'La compra se guardará como borrador y todavía no modificará el stock.'}
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.generalFields}>
              <Text style={styles.fieldLabel}>Proveedor *</Text>
              <Menu
                anchor={<Pressable disabled={readOnly} onPress={() => setOpenMenu({ type: 'supplier' })} style={[styles.selector, readOnly && styles.selectorDisabled]}><Text style={styles.selectorText}>{selectedSupplier?.name ?? 'Seleccionar proveedor'}</Text>{!readOnly ? <Icon source="chevron-down" color="#60706E" size={21} /> : null}</Pressable>}
                onDismiss={() => setOpenMenu(null)}
                visible={openMenu?.type === 'supplier'}
              >
                {suppliers.map((supplier) => <Menu.Item key={supplier.id} onPress={() => { setSupplierId(supplier.id); setOpenMenu(null); }} title={supplier.name} />)}
              </Menu>

              <Text style={styles.fieldLabel}>Almacén de destino *</Text>
              <Menu
                anchor={<Pressable disabled={readOnly} onPress={() => setOpenMenu({ type: 'warehouse' })} style={[styles.selector, readOnly && styles.selectorDisabled]}><Text style={styles.selectorText}>{selectedWarehouse?.name ?? 'Seleccionar almacén'}</Text>{!readOnly ? <Icon source="chevron-down" color="#60706E" size={21} /> : null}</Pressable>}
                onDismiss={() => setOpenMenu(null)}
                visible={openMenu?.type === 'warehouse'}
              >
                {warehouses.map((warehouse) => <Menu.Item key={warehouse.id} onPress={() => { setWarehouseId(warehouse.id); setOpenMenu(null); }} title={`${warehouse.name} · ${warehouse.code}`} />)}
              </Menu>

              <TextInput editable={!readOnly} label="Fecha (AAAA-MM-DD) *" mode="flat" onChangeText={setOrderedAt} style={styles.input} value={orderedAt} />
              <View style={styles.numberRow}>
                <TextInput autoCapitalize="characters" editable={!readOnly} label="Serie de factura" maxLength={20} mode="flat" onChangeText={setInvoiceSeries} style={styles.numberInput} value={invoiceSeries} />
                <TextInput editable={!readOnly} label="Correlativo de factura" maxLength={100} mode="flat" onChangeText={setInvoiceNumber} style={styles.numberInput} value={invoiceNumber} />
              </View>
              <TextInput editable={!readOnly} label="Nota u observación (opcional)" mode="flat" multiline numberOfLines={3} onChangeText={setNotes} style={styles.input} value={notes} />
            </View>

            <View style={styles.productsHeader}>
              <Text style={styles.productsHeaderText}>Productos</Text>
            </View>
            <View style={styles.productsContent}>
              <ProductableLines items={items} onAdd={openNewLine} onOpen={openLine} products={products} readOnly={readOnly} />
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      <PurchaseProductableEditor
        initialItem={selectedLine}
        onClose={() => setLineEditorVisible(false)}
        onDelete={removeLine}
        onSave={saveLine}
        products={products}
        readOnly={readOnly}
        visible={lineEditorVisible}
      />
    </ModuleLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' },
  loader: { flex: 1 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 56 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { marginTop: 20, color: '#172423', fontSize: 24, fontWeight: '800' },
  subtitle: { marginTop: 6, color: '#60706E', fontSize: 12, lineHeight: 18 },
  error: { marginTop: 16, padding: 12, borderRadius: 8, color: '#8F1D2C', backgroundColor: '#FCE8EA' },
  generalFields: { marginTop: 24, gap: 18 },
  productsHeader: { marginTop: 30, minHeight: 42, paddingHorizontal: 17, alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D5D2D6', borderTopColor: '#B4232D', borderBottomWidth: 0, backgroundColor: '#FFFFFF' },
  productsHeaderText: { color: '#172423', fontSize: 13, fontWeight: '800' },
  productsContent: { paddingTop: 18, borderTopWidth: 1, borderTopColor: '#D5D2D6' },
  section: { marginTop: 24, gap: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#172423', fontSize: 16, fontWeight: '800' },
  fieldLabel: { marginBottom: -10, color: '#60706E', fontSize: 11 },
  selector: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#879692' },
  selectorDisabled: { opacity: 0.72 },
  selectorText: { flex: 1, color: '#172423', fontSize: 14 },
  input: { backgroundColor: 'transparent' },
  itemCard: { padding: 15, gap: 13, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 12, backgroundColor: '#FFFFFF' },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemTitle: { color: '#172423', fontSize: 12, fontWeight: '800' },
  numberRow: { flexDirection: 'row', gap: 14 },
  numberInput: { flex: 1, backgroundColor: 'transparent' },
  subtotal: { textAlign: 'right', color: '#60706E', fontSize: 11, fontWeight: '700' },
  totalRow: { paddingTop: 14, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#D7E0DE' },
  totalLabel: { color: '#172423', fontSize: 16, fontWeight: '800' },
  totalValue: { color: '#B4232D', fontSize: 19, fontWeight: '900' },
});
