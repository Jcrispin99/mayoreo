import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Button, Icon, Menu, Switch, Text, TextInput } from 'react-native-paper';
import { ModuleLayout } from '../../components/module/module-layout';
import { getVisibleMenu } from '../../config/menu';
import { api } from '../../lib/api';
import type { Store, Warehouse } from '../inventory/inventory-types';
import type { CashRegister, DocumentSeries, PosDocumentType } from './pos-types';

type CashRegisterFormProps = { cashRegisterId?: string };
type CashRegisterTab = 'general' | 'billing';

const POS_MODULE = getVisibleMenu().find((module) => module.id === 'pos');
const DOCUMENT_TYPE_LABELS: Record<PosDocumentType, string> = {
  sales_ticket: 'Nota de venta',
  receipt: 'Boleta',
  invoice: 'Factura',
};

function requestErrorMessage(error: any) {
  const validationErrors = error?.response?.data?.errors;
  const firstValidationError = validationErrors ? Object.values(validationErrors).flat()[0] : null;
  if (typeof firstValidationError === 'string') return firstValidationError;
  return error?.response?.data?.message ?? 'No se pudo completar la operación.';
}

export function CashRegisterForm({ cashRegisterId }: CashRegisterFormProps) {
  const editing = Boolean(cashRegisterId);
  const { width } = useWindowDimensions();
  const compactLayout = width < 720;
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [storeId, setStoreId] = useState<number | null>(null);
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [selectedSeriesIds, setSelectedSeriesIds] = useState<number[]>([]);
  const [defaultSeriesId, setDefaultSeriesId] = useState<number | null>(null);
  const [active, setActive] = useState(true);
  const [activeTab, setActiveTab] = useState<CashRegisterTab>('general');
  const [documentSeries, setDocumentSeries] = useState<DocumentSeries[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [storeMenuVisible, setStoreMenuVisible] = useState(false);
  const [warehouseMenuVisible, setWarehouseMenuVisible] = useState(false);
  const [addSeriesMenuVisible, setAddSeriesMenuVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedStore = stores.find((store) => store.id === storeId);
  const availableWarehouses = useMemo(
    () => warehouses.filter((warehouse) => warehouse.store_id === storeId && warehouse.is_active),
    [storeId, warehouses],
  );
  const selectedWarehouse = availableWarehouses.find((warehouse) => warehouse.id === warehouseId);
  const availableSeries = useMemo(
    () => documentSeries.filter((series) => series.is_active && (
      series.assigned_cash_register_id === null
      || String(series.assigned_cash_register_id) === cashRegisterId
    )),
    [cashRegisterId, documentSeries],
  );
  const selectedSeries = useMemo(
    () => availableSeries.filter((series) => selectedSeriesIds.includes(series.id)),
    [availableSeries, selectedSeriesIds],
  );
  const seriesAvailableToAdd = useMemo(
    () => availableSeries.filter((series) => !selectedSeriesIds.includes(series.id)),
    [availableSeries, selectedSeriesIds],
  );

  useEffect(() => {
    async function loadForm() {
      setLoading(true);
      setError('');
      try {
        const [storesResponse, warehousesResponse, seriesResponse, cashRegisterResponse] = await Promise.all([
          api.get('/stores', { params: { is_active: true } }),
          api.get('/warehouses', { params: { is_active: true } }),
          api.get('/document-series'),
          cashRegisterId ? api.get(`/cash-registers/${cashRegisterId}`) : Promise.resolve(null),
        ]);
        const loadedStores: Store[] = storesResponse.data.data ?? [];
        const loadedWarehouses: Warehouse[] = warehousesResponse.data.data ?? [];
        const loadedSeries: DocumentSeries[] = seriesResponse.data.data ?? [];
        const loadedCashRegister: CashRegister | null = cashRegisterResponse?.data.data ?? null;
        setStores(loadedStores);
        setWarehouses(loadedWarehouses);
        setDocumentSeries(loadedSeries);

        if (loadedCashRegister) {
          setCode(loadedCashRegister.code);
          setName(loadedCashRegister.name);
          setStoreId(loadedCashRegister.store_id);
          setWarehouseId(loadedCashRegister.warehouse_id);
          setSelectedSeriesIds(loadedCashRegister.sales_series.map((series) => series.id));
          setDefaultSeriesId(loadedCashRegister.default_sales_series_id);
          setActive(loadedCashRegister.is_active);
        } else {
          const initialStoreId = loadedStores[0]?.id ?? null;
          setStoreId(initialStoreId);
          setWarehouseId(loadedWarehouses.find((warehouse) => warehouse.store_id === initialStoreId)?.id ?? null);
          setSelectedSeriesIds([]);
          setDefaultSeriesId(null);
        }
      } catch (requestError) {
        setError(requestErrorMessage(requestError));
      } finally {
        setLoading(false);
      }
    }

    void loadForm();
  }, [cashRegisterId]);

  function selectStore(nextStoreId: number) {
    setStoreId(nextStoreId);
    setWarehouseId(warehouses.find((warehouse) => warehouse.store_id === nextStoreId && warehouse.is_active)?.id ?? null);
    setStoreMenuVisible(false);
  }

  function addSeries(seriesId: number) {
    setSelectedSeriesIds((current) => {
      if (current.includes(seriesId)) return current;
      if (defaultSeriesId === null) setDefaultSeriesId(seriesId);
      return [...current, seriesId];
    });
    setAddSeriesMenuVisible(false);
  }

  function removeSeries(seriesId: number) {
    setSelectedSeriesIds((current) => {
      const next = current.filter((id) => id !== seriesId);
      if (defaultSeriesId === seriesId) setDefaultSeriesId(next[0] ?? null);
      return next;
    });
  }

  async function save() {
    if (!code.trim() || !name.trim() || !storeId || !warehouseId || selectedSeriesIds.length === 0 || !defaultSeriesId) {
      setError('Completa todos los campos obligatorios.');
      if (selectedSeriesIds.length === 0 || !defaultSeriesId) setActiveTab('billing');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        store_id: storeId,
        warehouse_id: warehouseId,
        default_sales_series_id: defaultSeriesId,
        sales_series_ids: selectedSeriesIds,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        is_active: active,
      };

      if (editing) await api.put(`/cash-registers/${cashRegisterId}`, payload);
      else await api.post('/cash-registers', payload);
      router.back();
    } catch (requestError) {
      setError(requestErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  if (!POS_MODULE) return null;

  return (
    <ModuleLayout module={POS_MODULE} selectedItemId="cash-registers">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        {loading ? (
          <ActivityIndicator color="#B4232D" size="large" style={styles.loader} />
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Button compact icon="arrow-left" mode="text" onPress={() => router.back()}>Volver</Button>
              <Button buttonColor="#FF4D4D" compact disabled={saving} loading={saving} mode="contained" onPress={() => void save()}>
                Guardar
              </Button>
            </View>

            <Text style={styles.title}>{editing ? 'Editar caja' : 'Nueva caja'}</Text>
            <Text style={styles.subtitle}>Define de qué almacén retirará mercadería y qué correlativos utilizará.</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View accessibilityRole="tablist" style={styles.tabs}>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'general' }}
                onPress={() => setActiveTab('general')}
                style={[styles.tab, activeTab === 'general' && styles.activeTab]}
              >
                <Icon color={activeTab === 'general' ? '#B4232D' : '#60706E'} size={18} source="tune-variant" />
                <Text style={[styles.tabText, activeTab === 'general' && styles.activeTabText]}>Datos generales</Text>
              </Pressable>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'billing' }}
                onPress={() => setActiveTab('billing')}
                style={[styles.tab, activeTab === 'billing' && styles.activeTab]}
              >
                <Icon color={activeTab === 'billing' ? '#B4232D' : '#60706E'} size={18} source="file-document-outline" />
                <Text style={[styles.tabText, activeTab === 'billing' && styles.activeTabText]}>Facturación</Text>
              </Pressable>
            </View>

            {activeTab === 'general' ? (
              <View style={styles.section}>
                <View>
                  <Text style={styles.sectionTitle}>Identificación y ubicación</Text>
                  <Text style={styles.sectionIntro}>Información permanente que utilizará esta caja.</Text>
                </View>
                <View style={[styles.fieldRow, compactLayout && styles.fieldColumn]}>
                  <View style={styles.fieldControl}>
                    <TextInput
                      activeOutlineColor="#B4232D"
                      autoCapitalize="characters"
                      label="Código *"
                      mode="outlined"
                      onChangeText={setCode}
                      outlineColor="#879692"
                      style={styles.textInput}
                      value={code}
                    />
                  </View>
                  <View style={styles.fieldControl}>
                    <TextInput
                      activeOutlineColor="#B4232D"
                      label="Nombre *"
                      mode="outlined"
                      onChangeText={setName}
                      outlineColor="#879692"
                      style={styles.textInput}
                      value={name}
                    />
                  </View>
                </View>

                <View style={styles.locationField}>
                  <Menu
                    anchor={(
                      <Pressable onPress={() => setStoreMenuVisible(true)} style={styles.selector}>
                        <View style={styles.selectorIcon}>
                          <Icon source="storefront-outline" size={22} color="#B4232D" />
                        </View>
                        <View style={styles.selectorContent}>
                          <Text style={styles.selectorLabel}>Tienda *</Text>
                          <Text style={selectedStore ? styles.selectorText : styles.selectorPlaceholder}>{selectedStore?.name ?? 'Seleccionar tienda'}</Text>
                          {selectedStore ? <Text style={styles.selectorMeta}>Código {selectedStore.code}</Text> : null}
                        </View>
                        <Icon source="chevron-down" size={22} color="#60706E" />
                      </Pressable>
                    )}
                    onDismiss={() => setStoreMenuVisible(false)}
                    visible={storeMenuVisible}
                  >
                    {stores.map((store) => <Menu.Item key={store.id} onPress={() => selectStore(store.id)} title={`${store.code} · ${store.name}`} />)}
                  </Menu>
                </View>

                <View style={styles.locationField}>
                  <Menu
                    anchor={(
                      <Pressable onPress={() => setWarehouseMenuVisible(true)} style={styles.selector}>
                        <View style={styles.selectorIcon}>
                          <Icon source="warehouse" size={22} color="#B4232D" />
                        </View>
                        <View style={styles.selectorContent}>
                          <Text style={styles.selectorLabel}>Almacén de salida *</Text>
                          <Text style={selectedWarehouse ? styles.selectorText : styles.selectorPlaceholder}>{selectedWarehouse?.name ?? 'Seleccionar almacén'}</Text>
                          {selectedWarehouse ? <Text style={styles.selectorMeta}>{selectedWarehouse.code} · Origen del stock para las ventas</Text> : null}
                        </View>
                        <Icon source="chevron-down" size={22} color="#60706E" />
                      </Pressable>
                    )}
                    onDismiss={() => setWarehouseMenuVisible(false)}
                    visible={warehouseMenuVisible}
                  >
                    {availableWarehouses.map((warehouse) => (
                      <Menu.Item key={warehouse.id} onPress={() => { setWarehouseId(warehouse.id); setWarehouseMenuVisible(false); }} title={`${warehouse.code} · ${warehouse.name}`} />
                    ))}
                  </Menu>
                </View>

                <View style={styles.statusCard}>
                  <View>
                    <Text style={styles.switchTitle}>Caja activa</Text>
                    <Text style={styles.switchHelp}>Solo las cajas activas podrán utilizarse en el POS.</Text>
                  </View>
                  <Switch color="#B4232D" onValueChange={setActive} value={active} />
                </View>
              </View>
            ) : (
              <View style={styles.section}>
                <View>
                  <Text style={styles.sectionTitle}>Series para ventas</Text>
                  <Text style={styles.sectionIntro}>Administra las series asignadas a esta caja y define cuál se utilizará inicialmente.</Text>
                </View>
                <View style={styles.seriesBlock}>
                  <View style={styles.seriesBlockTitleRow}>
                    <Text style={styles.seriesBlockTitle}>Series asignadas</Text>
                    <View style={styles.seriesCountBadge}>
                      <Text style={styles.seriesCountText}>{selectedSeries.length}</Text>
                    </View>
                  </View>

                  <View style={styles.seriesTable}>
                    <View style={styles.seriesTableHeader}>
                      <Text style={[styles.tableHeaderText, styles.seriesColumn]}>SERIE</Text>
                      <Text style={[styles.tableHeaderText, styles.correlativeColumn]}>CORRELATIVO</Text>
                      <Text style={[styles.tableHeaderText, styles.actionsColumn]}>ACCIONES</Text>
                    </View>
                    {selectedSeries.length === 0 ? (
                      <View style={styles.emptyTableRow}>
                        <Icon color="#60706E" size={24} source="file-document-outline" />
                        <Text style={styles.emptyTableText}>Aún no has agregado series a esta caja.</Text>
                      </View>
                    ) : selectedSeries.map((series) => {
                      const isDefault = series.id === defaultSeriesId;
                      return (
                        <View key={series.id} style={[styles.seriesTableRow, isDefault && styles.defaultSeriesRow]}>
                          <View style={styles.seriesColumn}>
                            <View style={styles.seriesIdentityRow}>
                              <Text style={styles.seriesCode}>{series.series_code}</Text>
                              {isDefault ? (
                                <View style={styles.defaultBadge}>
                                  <Icon color="#8A5A00" size={12} source="star" />
                                  <Text style={styles.defaultBadgeText}>Principal</Text>
                                </View>
                              ) : null}
                            </View>
                            <Text style={styles.seriesType}>{DOCUMENT_TYPE_LABELS[series.document_type]}</Text>
                          </View>
                          <View style={styles.correlativeColumn}>
                            <Text style={styles.nextNumber}>{series.next_number}</Text>
                            <Text style={styles.correlativeMeta}>Próximo</Text>
                          </View>
                          <View style={[styles.actionsColumn, styles.seriesActions]}>
                            <Pressable
                              accessibilityLabel={`Usar ${series.series_code} como serie principal`}
                              accessibilityRole="button"
                              accessibilityState={{ selected: isDefault }}
                              onPress={() => setDefaultSeriesId(series.id)}
                              style={({ pressed }) => [styles.tableAction, isDefault && styles.defaultTableAction, pressed && styles.pressedAction]}
                            >
                              <Icon color={isDefault ? '#9A6500' : '#60706E'} size={19} source={isDefault ? 'star' : 'star-outline'} />
                            </Pressable>
                            <Pressable
                              accessibilityLabel={`Quitar serie ${series.series_code}`}
                              accessibilityRole="button"
                              onPress={() => removeSeries(series.id)}
                              style={({ pressed }) => [styles.tableAction, styles.removeTableAction, pressed && styles.pressedAction]}
                            >
                              <Icon color="#8F1D2C" size={19} source="trash-can-outline" />
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.addSeriesField}>
                  <Text style={styles.addSeriesLabel}>Agregar serie</Text>
                  <Menu
                    anchor={(
                      <Pressable
                        disabled={seriesAvailableToAdd.length === 0}
                        onPress={() => setAddSeriesMenuVisible(true)}
                        style={[styles.addSeriesSelector, seriesAvailableToAdd.length === 0 && styles.disabledSelector]}
                      >
                        <View style={styles.addSeriesIcon}>
                          <Icon color="#B4232D" size={21} source="plus" />
                        </View>
                        <View style={styles.selectorContent}>
                          <Text style={seriesAvailableToAdd.length > 0 ? styles.selectorText : styles.selectorPlaceholder}>
                            {seriesAvailableToAdd.length > 0 ? 'Seleccionar una serie disponible' : 'No hay más series disponibles'}
                          </Text>
                          <Text style={styles.selectorMeta}>La serie seleccionada se agregará a la tabla</Text>
                        </View>
                        <Icon color="#60706E" size={22} source="chevron-down" />
                      </Pressable>
                    )}
                    onDismiss={() => setAddSeriesMenuVisible(false)}
                    visible={addSeriesMenuVisible}
                  >
                    {seriesAvailableToAdd.map((series) => (
                      <Menu.Item
                        key={series.id}
                        leadingIcon="file-document-outline"
                        onPress={() => addSeries(series.id)}
                        title={`${series.series_code} · ${DOCUMENT_TYPE_LABELS[series.document_type]}`}
                        trailingIcon="plus"
                      />
                    ))}
                  </Menu>
                </View>

                {availableSeries.length === 0 && selectedSeries.length === 0 ? (
                  <Text style={styles.emptySeries}>No hay series de venta disponibles. Crea una desde “Series y correlativos”.</Text>
                ) : null}
              </View>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </ModuleLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' },
  loader: { flex: 1 },
  content: { width: '100%', maxWidth: 1040, alignSelf: 'center', padding: 20, paddingBottom: 48, gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#172423', fontSize: 25, fontWeight: '900' },
  subtitle: { marginTop: -10, color: '#60706E', fontSize: 13 },
  error: { padding: 12, borderRadius: 10, color: '#8F1D2C', backgroundColor: '#FCE8EA', fontSize: 12, fontWeight: '700' },
  tabs: { flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: '#879692', gap: 4 },
  tab: { flex: 1, minWidth: 0, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1, borderColor: 'transparent', borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundColor: '#EAEFEE', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  activeTab: { marginBottom: -1, borderColor: '#879692', borderBottomColor: '#FFFFFF', backgroundColor: '#FFFFFF' },
  tabText: { color: '#60706E', fontSize: 12, fontWeight: '800' },
  activeTabText: { color: '#B4232D' },
  section: { padding: 18, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 14, backgroundColor: '#FFFFFF', gap: 16 },
  sectionTitle: { color: '#172423', fontSize: 16, fontWeight: '900' },
  sectionIntro: { marginTop: 4, color: '#60706E', fontSize: 11, lineHeight: 16 },
  fieldRow: { width: '100%', flexDirection: 'row', gap: 14 },
  fieldColumn: { flexDirection: 'column' },
  fieldControl: { flex: 1, minWidth: 0 },
  textInput: { width: '100%', height: 56, backgroundColor: '#FFFFFF' },
  locationField: { width: '100%' },
  selector: { minHeight: 72, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#879692', borderRadius: 10, backgroundColor: '#FFFFFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  selectorIcon: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#FFE5E5', justifyContent: 'center', alignItems: 'center' },
  selectorContent: { flex: 1, minWidth: 0, gap: 2 },
  selectorLabel: { color: '#60706E', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  selectorText: { color: '#172423', fontSize: 14, fontWeight: '700' },
  selectorPlaceholder: { color: '#60706E', fontSize: 13 },
  selectorMeta: { color: '#60706E', fontSize: 10 },
  statusCard: { padding: 14, borderRadius: 10, backgroundColor: '#EAEFEE', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  switchTitle: { color: '#172423', fontSize: 13, fontWeight: '800' },
  switchHelp: { marginTop: 3, color: '#60706E', fontSize: 10 },
  emptySeries: { padding: 12, borderRadius: 8, color: '#8A5A32', backgroundColor: '#FFF4E8', fontSize: 11, lineHeight: 16 },
  seriesBlock: { gap: 8 },
  seriesBlockTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  seriesBlockTitle: { color: '#172423', fontSize: 12, fontWeight: '800' },
  seriesCountBadge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: '#FFE5E5', alignItems: 'center', justifyContent: 'center' },
  seriesCountText: { color: '#B4232D', fontSize: 10, fontWeight: '900' },
  seriesTable: { overflow: 'hidden', borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 10, backgroundColor: '#FFFFFF' },
  seriesTableHeader: { minHeight: 34, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#EAEFEE' },
  tableHeaderText: { color: '#60706E', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  seriesTableRow: { minHeight: 66, paddingHorizontal: 12, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D7E0DE', flexDirection: 'row', alignItems: 'center' },
  defaultSeriesRow: { backgroundColor: '#FFFCF3' },
  seriesColumn: { flex: 1, minWidth: 0 },
  correlativeColumn: { width: 76, alignItems: 'center' },
  actionsColumn: { width: 82, alignItems: 'center' },
  seriesIdentityRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  seriesCode: { color: '#172423', fontSize: 13, fontWeight: '900' },
  seriesType: { marginTop: 3, color: '#60706E', fontSize: 10 },
  defaultBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, backgroundColor: '#FFF0C7', flexDirection: 'row', alignItems: 'center', gap: 3 },
  defaultBadgeText: { color: '#8A5A00', fontSize: 7, fontWeight: '900' },
  nextNumber: { color: '#172423', fontSize: 13, fontWeight: '800' },
  correlativeMeta: { marginTop: 2, color: '#60706E', fontSize: 8 },
  seriesActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 5 },
  tableAction: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#EAEFEE', alignItems: 'center', justifyContent: 'center' },
  defaultTableAction: { backgroundColor: '#FFF0C7' },
  removeTableAction: { backgroundColor: '#FCE8EA' },
  pressedAction: { opacity: 0.62 },
  emptyTableRow: { minHeight: 82, padding: 16, alignItems: 'center', justifyContent: 'center', gap: 6 },
  emptyTableText: { color: '#60706E', fontSize: 10, textAlign: 'center' },
  addSeriesField: { gap: 5 },
  addSeriesLabel: { color: '#60706E', fontSize: 11, fontWeight: '700' },
  addSeriesSelector: { minHeight: 62, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: '#879692', borderRadius: 10, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 11 },
  addSeriesIcon: { width: 38, height: 38, borderRadius: 9, backgroundColor: '#FFE5E5', justifyContent: 'center', alignItems: 'center' },
  disabledSelector: { opacity: 0.55, backgroundColor: '#EAEFEE' },
});
