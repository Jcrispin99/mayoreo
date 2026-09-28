import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Icon, Menu, Switch, Text, TextInput } from 'react-native-paper';
import { ModuleLayout } from '../../components/module/module-layout';
import { getVisibleMenu } from '../../config/menu';
import { api } from '../../lib/api';
import type { InventoryItem, InventoryResourceKind, Store, UnitOfMeasure, Warehouse } from './inventory-types';

type InventoryReferenceFormProps = {
  itemId?: string;
  kind: InventoryResourceKind;
};

const INVENTORY_MODULE = getVisibleMenu().find((module) => module.id === 'inventory');

const CONFIG = {
  stores: { endpoint: '/stores', singular: 'tienda', article: 'la' },
  warehouses: { endpoint: '/warehouses', singular: 'almacén', article: 'el' },
  units: { endpoint: '/units-of-measure', singular: 'unidad de medida', article: 'la' },
} as const;

const TYPE_LABELS = {
  weight: 'Peso',
  volume: 'Volumen',
  count: 'Conteo',
} as const;

function requestErrorMessage(error: any) {
  const validationErrors = error?.response?.data?.errors;
  const firstValidationError = validationErrors ? Object.values(validationErrors).flat()[0] : null;
  if (typeof firstValidationError === 'string') return firstValidationError;
  return error?.response?.data?.message ?? 'No se pudo completar la operación.';
}

export function InventoryReferenceForm({ itemId, kind }: InventoryReferenceFormProps) {
  const config = CONFIG[kind];
  const editing = Boolean(itemId);
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [attendanceLatitude, setAttendanceLatitude] = useState('');
  const [attendanceLongitude, setAttendanceLongitude] = useState('');
  const [attendanceRadius, setAttendanceRadius] = useState('100');
  const [locating, setLocating] = useState(false);
  const [active, setActive] = useState(true);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [unitType, setUnitType] = useState<UnitOfMeasure['type']>('count');
  const [stores, setStores] = useState<Store[]>([]);
  const [storeMenuVisible, setStoreMenuVisible] = useState(false);
  const [typeMenuVisible, setTypeMenuVisible] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedStore = stores.find((store) => store.id === storeId);
  const originalWarehouse = kind === 'warehouses' ? item as Warehouse | null : null;

  useEffect(() => {
    async function loadForm() {
      setLoading(true);
      setError('');
      try {
        const [itemResponse, storesResponse] = await Promise.all([
          itemId ? api.get(`${config.endpoint}/${itemId}`) : Promise.resolve(null),
          kind === 'warehouses' ? api.get('/stores') : Promise.resolve(null),
        ]);
        const loadedStores: Store[] = storesResponse?.data.data ?? [];
        const loadedItem: InventoryItem | null = itemResponse?.data.data ?? null;
        setStores(loadedStores);
        setItem(loadedItem);

        if (loadedItem) {
          setCode(loadedItem.code ?? '');
          setName(loadedItem.name ?? '');

          if (kind === 'stores') {
            const store = loadedItem as Store;
            setAddress(store.address ?? '');
            setPhone(store.phone ?? '');
            setAttendanceLatitude(store.attendance_latitude ?? '');
            setAttendanceLongitude(store.attendance_longitude ?? '');
            setAttendanceRadius(String(store.attendance_radius_meters ?? 100));
            setActive(store.is_active);
          } else if (kind === 'warehouses') {
            const warehouse = loadedItem as Warehouse;
            setStoreId(warehouse.store_id);
            setActive(warehouse.is_active);
            setIsDefault(warehouse.is_default);
          } else {
            setUnitType((loadedItem as UnitOfMeasure).type);
          }
        } else if (kind === 'warehouses') {
          setStoreId(loadedStores[0]?.id ?? null);
        }
      } catch (requestError) {
        setError(requestErrorMessage(requestError));
      } finally {
        setLoading(false);
      }
    }

    void loadForm();
  }, [config.endpoint, itemId, kind]);

  async function save() {
    if (!code.trim() || !name.trim() || (kind === 'warehouses' && !storeId)) {
      setError('Completa todos los campos obligatorios.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const basePayload = { code: code.trim().toUpperCase(), name: name.trim() };
      let payload: Record<string, unknown>;

      if (kind === 'stores') {
        payload = {
          ...basePayload,
          address: address.trim() || null,
          phone: phone.trim() || null,
          attendance_latitude: attendanceLatitude.trim() || null,
          attendance_longitude: attendanceLongitude.trim() || null,
          attendance_radius_meters: Number(attendanceRadius),
          is_active: active,
        };
      } else if (kind === 'warehouses') {
        payload = {
          ...basePayload,
          ...(!editing ? { store_id: storeId, type: 'retail' } : {}),
          is_active: active,
          is_default: isDefault,
        };
      } else {
        payload = { ...basePayload, type: unitType };
      }

      if (editing) {
        await api.put(`${config.endpoint}/${itemId}`, payload);
      } else {
        await api.post(config.endpoint, payload);
      }
      router.back();
    } catch (requestError) {
      setError(requestErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!itemId) return;
    setSaving(true);
    setError('');
    try {
      await api.delete(`${config.endpoint}/${itemId}`);
      router.back();
    } catch (requestError) {
      setError(requestErrorMessage(requestError));
      setConfirmingDelete(false);
    } finally {
      setSaving(false);
    }
  }

  async function captureAttendanceLocation() {
    setLocating(true);
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        throw new Error('Necesitas permitir la ubicación para registrar las coordenadas de la tienda.');
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setAttendanceLatitude(location.coords.latitude.toFixed(7));
      setAttendanceLongitude(location.coords.longitude.toFixed(7));
    } catch (locationError) {
      setError(locationError instanceof Error ? locationError.message : 'No se pudo obtener la ubicación actual.');
    } finally {
      setLocating(false);
    }
  }

  if (!INVENTORY_MODULE) return null;

  const title = editing ? `Editar ${config.singular}` : `Nuev${kind === 'warehouses' ? 'o' : 'a'} ${config.singular}`;

  return (
    <ModuleLayout module={INVENTORY_MODULE} selectedItemId={kind}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        {loading ? (
          <ActivityIndicator color="#B4232D" size="large" style={styles.loader} />
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Button compact icon="arrow-left" mode="text" onPress={() => router.back()}>Volver</Button>
              <Button
                buttonColor="#FF4D4D"
                compact
                disabled={saving}
                loading={saving}
                mode="contained"
                onPress={() => void save()}
              >
                Guardar
              </Button>
            </View>

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>
              {kind === 'stores'
                ? 'Al crear la tienda se generará automáticamente su almacén principal.'
                : kind === 'warehouses'
                  ? 'Configura la ubicación donde se controlará el stock.'
                  : 'Esta unidad podrá asignarse a los productos del catálogo.'}
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.form}>
              <TextInput
                autoCapitalize="characters"
                label="Código *"
                mode="flat"
                onChangeText={setCode}
                style={styles.input}
                value={code}
              />
              <TextInput label="Nombre *" mode="flat" onChangeText={setName} style={styles.input} value={name} />

              {kind === 'stores' ? (
                <>
                  <TextInput label="Dirección" mode="flat" onChangeText={setAddress} style={styles.input} value={address} />
                  <TextInput keyboardType="phone-pad" label="Teléfono" mode="flat" onChangeText={setPhone} style={styles.input} value={phone} />
                  <View style={styles.locationCard}>
                    <View>
                      <Text style={styles.switchText}>Área autorizada para asistencia</Text>
                      <Text style={styles.switchHelp}>Ubícate físicamente en la tienda y captura sus coordenadas. Los trabajadores solo podrán marcar dentro del radio indicado.</Text>
                    </View>
                    <Button icon="crosshairs-gps" loading={locating} mode="outlined" onPress={() => void captureAttendanceLocation()}>
                      Usar ubicación actual
                    </Button>
                    <View style={styles.coordinateRow}>
                      <TextInput keyboardType="numbers-and-punctuation" label="Latitud" mode="flat" onChangeText={setAttendanceLatitude} style={styles.coordinateInput} value={attendanceLatitude} />
                      <TextInput keyboardType="numbers-and-punctuation" label="Longitud" mode="flat" onChangeText={setAttendanceLongitude} style={styles.coordinateInput} value={attendanceLongitude} />
                    </View>
                    <TextInput keyboardType="number-pad" label="Radio permitido (metros)" mode="flat" onChangeText={setAttendanceRadius} style={styles.input} value={attendanceRadius} />
                  </View>
                </>
              ) : null}

              {kind === 'warehouses' ? (
                <View>
                  <Text style={styles.fieldLabel}>Tienda *</Text>
                  <Menu
                    anchor={
                      <Pressable
                        disabled={editing}
                        onPress={() => setStoreMenuVisible(true)}
                        style={[styles.selector, editing && styles.selectorDisabled]}
                      >
                        <Text style={styles.selectorText}>{selectedStore?.name ?? 'Seleccionar tienda'}</Text>
                        <Icon source="chevron-down" color="#60706E" size={21} />
                      </Pressable>
                    }
                    onDismiss={() => setStoreMenuVisible(false)}
                    visible={storeMenuVisible}
                  >
                    {stores.map((store) => (
                      <Menu.Item
                        key={store.id}
                        leadingIcon={store.id === storeId ? 'check' : undefined}
                        onPress={() => {
                          setStoreId(store.id);
                          setStoreMenuVisible(false);
                        }}
                        title={store.name}
                      />
                    ))}
                  </Menu>
                </View>
              ) : null}

              {kind === 'units' ? (
                <View>
                  <Text style={styles.fieldLabel}>Tipo *</Text>
                  <Menu
                    anchor={
                      <Pressable onPress={() => setTypeMenuVisible(true)} style={styles.selector}>
                        <Text style={styles.selectorText}>{TYPE_LABELS[unitType]}</Text>
                        <Icon source="chevron-down" color="#60706E" size={21} />
                      </Pressable>
                    }
                    onDismiss={() => setTypeMenuVisible(false)}
                    visible={typeMenuVisible}
                  >
                    {(Object.keys(TYPE_LABELS) as UnitOfMeasure['type'][]).map((type) => (
                      <Menu.Item
                        key={type}
                        leadingIcon={type === unitType ? 'check' : undefined}
                        onPress={() => {
                          setUnitType(type);
                          setTypeMenuVisible(false);
                        }}
                        title={TYPE_LABELS[type]}
                      />
                    ))}
                  </Menu>
                </View>
              ) : null}

              {kind !== 'units' ? (
                <View style={styles.switchRow}>
                  <Text style={styles.switchText}>Activo</Text>
                  <Switch disabled={kind === 'warehouses' && isDefault} onValueChange={setActive} value={active} />
                </View>
              ) : null}

              {kind === 'warehouses' ? (
                <View style={styles.switchRow}>
                  <View style={styles.switchCopy}>
                    <Text style={styles.switchText}>Almacén principal</Text>
                    <Text style={styles.switchHelp}>Será la ubicación principal de esta tienda.</Text>
                  </View>
                  <Switch
                    disabled={editing && Boolean(originalWarehouse?.is_default)}
                    onValueChange={(value) => {
                      setIsDefault(value);
                      if (value) setActive(true);
                    }}
                    value={isDefault}
                  />
                </View>
              ) : null}
            </View>

            {editing ? (
              <View style={styles.dangerZone}>
                {confirmingDelete ? (
                  <View>
                    <Text style={styles.dangerTitle}>¿Eliminar {name}?</Text>
                    <Text style={styles.dangerText}>
                      Si tiene operaciones o stock, el sistema evitará el borrado y podrás desactivarlo.
                    </Text>
                    <View style={styles.dangerActions}>
                      <Button disabled={saving} onPress={() => setConfirmingDelete(false)}>Cancelar</Button>
                      <Button loading={saving} mode="contained" onPress={() => void remove()} textColor="#FFFFFF" buttonColor="#8F1D2C">Eliminar</Button>
                    </View>
                  </View>
                ) : (
                  <Button icon="trash-can-outline" mode="text" onPress={() => setConfirmingDelete(true)} textColor="#8F1D2C">
                    Eliminar {config.article} {config.singular}
                  </Button>
                )}
              </View>
            ) : null}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </ModuleLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' },
  loader: { flex: 1 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { marginTop: 20, color: '#172423', fontSize: 24, fontWeight: '800' },
  subtitle: { marginTop: 6, color: '#60706E', fontSize: 12, lineHeight: 18 },
  error: { marginTop: 16, padding: 12, borderRadius: 8, color: '#8F1D2C', backgroundColor: '#FCE8EA' },
  form: { marginTop: 22, gap: 19 },
  input: { backgroundColor: 'transparent' },
  locationCard: { padding: 14, gap: 12, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 10, backgroundColor: '#FFFFFF' },
  coordinateRow: { flexDirection: 'row', gap: 12 },
  coordinateInput: { flex: 1, backgroundColor: 'transparent' },
  fieldLabel: { marginBottom: 3, color: '#60706E', fontSize: 11 },
  selector: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#879692' },
  selectorDisabled: { opacity: 0.65 },
  selectorText: { flex: 1, color: '#172423', fontSize: 15 },
  switchRow: { minHeight: 62, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#D7E0DE' },
  switchCopy: { flex: 1 },
  switchText: { flex: 1, color: '#172423', fontSize: 14, fontWeight: '700' },
  switchHelp: { marginTop: 3, color: '#60706E', fontSize: 10 },
  dangerZone: { marginTop: 42, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#D7E0DE', alignItems: 'flex-start' },
  dangerTitle: { color: '#8F1D2C', fontSize: 15, fontWeight: '800' },
  dangerText: { marginTop: 7, color: '#60706E', fontSize: 11, lineHeight: 17 },
  dangerActions: { marginTop: 12, flexDirection: 'row', gap: 8 },
});
