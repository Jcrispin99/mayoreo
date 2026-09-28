import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Icon, Menu, Text } from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';
import { api, apiErrorMessage } from '../../lib/api';
import { formatBusinessDateTime } from '../../lib/date-time';
import type { StoreSummary } from './workforce-types';

const QR_REFRESH_INTERVAL_MS = 30_000;

export function AttendanceQrScreen() {
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [payload, setPayload] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [rotatedAt, setRotatedAt] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const selectedStore = stores.find((store) => store.id === storeId);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const response = await api.get('/stores', { params: { is_active: true } });
        const loaded = response.data.data ?? [];
        setStores(loaded);
        setStoreId(loaded[0]?.id ?? null);
      } catch (requestError) {
        setError(apiErrorMessage(requestError, 'No se pudieron cargar las tiendas.'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadQr = useCallback(async (showLoading = false) => {
    if (!storeId) return;
    if (showLoading) setRefreshing(true);
    try {
      const response = await api.get(`/stores/${storeId}/attendance-qr`);
      setConfigured(Boolean(response.data.data.configured));
      setPayload(response.data.data.payload ?? '');
      setExpiresAt(response.data.data.expires_at ?? null);
      setRotatedAt(response.data.data.rotated_at ?? null);
      setError('');
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'No se pudo actualizar el QR dinámico.'));
    } finally {
      if (showLoading) setRefreshing(false);
    }
  }, [storeId]);

  useEffect(() => {
    setPayload('');
    setExpiresAt(null);
    setError('');
    setNotice('');
    void loadQr(true);
    const refreshTimer = setInterval(() => void loadQr(), QR_REFRESH_INTERVAL_MS);
    return () => clearInterval(refreshTimer);
  }, [loadQr]);

  useEffect(() => {
    const updateCountdown = () => {
      setSecondsRemaining(expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)) : 0);
    };
    updateCountdown();
    const countdownTimer = setInterval(updateCountdown, 1000);
    return () => clearInterval(countdownTimer);
  }, [expiresAt]);

  async function rotate() {
    if (!storeId) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await api.post(`/stores/${storeId}/attendance-qr/rotate`);
      setPayload(response.data.data.payload);
      setExpiresAt(response.data.data.expires_at);
      setRotatedAt(response.data.data.rotated_at);
      setConfigured(true);
      setNotice('Clave renovada. Todos los códigos anteriores dejaron de funcionar.');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? 'No se pudo generar el QR.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <ActivityIndicator color="#B4232D" size="large" style={styles.loader} />;

  const hasGeofence = selectedStore?.attendance_latitude && selectedStore?.attendance_longitude;

  return <ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.title}>QR dinámico de asistencia</Text>
    <Text style={styles.subtitle}>Mantén esta pantalla abierta en la tienda. El código se renueva automáticamente y una captura vence en menos de un minuto.</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    <Menu
      anchor={<Pressable onPress={() => setMenuVisible(true)} style={styles.selector}><View><Text style={styles.label}>Tienda</Text><Text style={styles.value}>{selectedStore?.name ?? 'Seleccionar tienda'}</Text></View><Icon source="chevron-down" size={22} color="#60706E" /></Pressable>}
      onDismiss={() => setMenuVisible(false)}
      visible={menuVisible}
    >
      {stores.map((store) => <Menu.Item key={store.id} onPress={() => { setStoreId(store.id); setMenuVisible(false); }} title={`${store.code} · ${store.name}`} />)}
    </Menu>
    {!hasGeofence ? <View style={styles.warning}><Icon source="map-marker-alert-outline" color="#8F5B00" size={24} /><Text style={styles.warningText}>Configura primero la ubicación y el radio de asistencia en la ficha de esta tienda.</Text></View> : null}
    <View style={styles.card}>
      {payload ? <>
        <View style={styles.qr}>
          <QRCode backgroundColor="#FFFFFF" color="#172423" quietZone={16} size={250} value={payload} />
        </View>
        <Text style={styles.ready}>Código activo · {secondsRemaining}s</Text>
        <Text style={styles.cardHelp}>La app lo actualizará automáticamente. Si llega a cero antes de renovarse, usa “Actualizar ahora”.</Text>
        {refreshing ? <ActivityIndicator color="#B4232D" /> : null}
        <Button icon="refresh" loading={refreshing} mode="outlined" onPress={() => void loadQr(true)}>Actualizar ahora</Button>
      </> : <>
        <Icon source={configured ? 'qrcode-edit' : 'qrcode-plus'} color="#60706E" size={72} />
        <Text style={styles.cardTitle}>{configured ? 'Actualizando el código dinámico…' : 'Esta tienda aún no tiene QR'}</Text>
        <Text style={styles.cardHelp}>{configured ? 'Espera unos segundos o actualiza nuevamente.' : 'Genera la clave inicial para habilitar las marcaciones dinámicas.'}</Text>
      </>}
      {rotatedAt ? <Text style={styles.rotated}>Clave renovada: {formatBusinessDateTime(rotatedAt)}</Text> : null}
      <Button buttonColor={payload ? undefined : '#FF4D4D'} icon="shield-refresh-outline" loading={saving} mode={payload ? 'text' : 'contained'} onPress={() => void rotate()}>{configured ? 'Invalidar y renovar clave' : 'Generar clave QR'}</Button>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  loader: { flex: 1 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  title: { color: '#172423', fontSize: 23, fontWeight: '900' },
  subtitle: { marginTop: 6, color: '#60706E', fontSize: 12, lineHeight: 18 },
  error: { marginTop: 14, padding: 12, color: '#8F1D2C', backgroundColor: '#FCE8EA' },
  notice: { marginTop: 14, padding: 12, color: '#17623F', backgroundColor: '#E7F5EE' },
  warning: { marginTop: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 9, backgroundColor: '#FFF3D6' },
  warningText: { flex: 1, color: '#8F5B00', fontSize: 11, lineHeight: 16 },
  selector: { marginTop: 22, minHeight: 64, padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#879692', borderRadius: 10, backgroundColor: '#FFFFFF' },
  label: { color: '#60706E', fontSize: 10 },
  value: { marginTop: 4, color: '#172423', fontSize: 14, fontWeight: '800' },
  card: { marginTop: 22, padding: 28, alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 14, backgroundColor: '#FFFFFF' },
  qr: { padding: 10, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 12, backgroundColor: '#FFFFFF' },
  ready: { color: '#247451', fontSize: 15, fontWeight: '900' },
  cardTitle: { color: '#172423', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  cardHelp: { maxWidth: 430, color: '#60706E', fontSize: 11, lineHeight: 17, textAlign: 'center' },
  rotated: { color: '#60706E', fontSize: 10 },
});
