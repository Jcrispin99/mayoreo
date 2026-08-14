import { useEffect, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Icon, Menu, Text } from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';
import { api, apiErrorMessage } from '../../lib/api';
import type { StoreSummary } from './workforce-types';

type QrSvgRef = {
  toDataURL: (callback: (base64: string) => void, options?: { width?: number; height?: number }) => void;
};

type ExportAction = 'download' | 'share' | null;

export function AttendanceQrScreen() {
  const qrRef = useRef<QrSvgRef | null>(null);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [payload, setPayload] = useState('');
  const [rotatedAt, setRotatedAt] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<ExportAction>(null);
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

  useEffect(() => {
    if (!storeId) return;
    setPayload('');
    setError('');
    setNotice('');
    void api.get(`/stores/${storeId}/attendance-qr`).then((response) => {
      setConfigured(Boolean(response.data.data.configured));
      setPayload(response.data.data.payload ?? '');
      setRotatedAt(response.data.data.rotated_at ?? null);
    }).catch((requestError) => setError(apiErrorMessage(requestError, 'No se pudo consultar el QR.')));
  }, [storeId]);

  async function rotate() {
    if (!storeId) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await api.post(`/stores/${storeId}/attendance-qr/rotate`);
      setPayload(response.data.data.payload);
      setRotatedAt(response.data.data.rotated_at);
      setConfigured(true);
      setNotice('QR renovado. El código anterior dejó de funcionar.');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? 'No se pudo generar el QR.');
    } finally {
      setSaving(false);
    }
  }

  function qrBase64(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!qrRef.current) {
        reject(new Error('El QR todavía no está listo.'));
        return;
      }
      qrRef.current.toDataURL(resolve, { width: 1024, height: 1024 });
    });
  }

  function fileName() {
    const code = selectedStore?.code?.toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'tienda';
    return `qr-asistencia-${code}.png`;
  }

  async function temporaryQrFile() {
    const directory = FileSystem.cacheDirectory;
    if (!directory) throw new Error('No se encontró almacenamiento temporal en el dispositivo.');
    const uri = `${directory}${fileName()}`;
    await FileSystem.writeAsStringAsync(uri, await qrBase64(), {
      encoding: FileSystem.EncodingType.Base64,
    });
    return uri;
  }

  async function download() {
    setExporting('download');
    setError('');
    setNotice('');
    try {
      const base64 = await qrBase64();
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = `data:image/png;base64,${base64}`;
        link.download = fileName();
        document.body.appendChild(link);
        link.click();
        link.remove();
        setNotice('Imagen QR descargada.');
        return;
      }

      const permission = await requestPermissionsAsync(true, ['photo']);
      if (permission.status !== 'granted') {
        throw new Error('Necesitas permitir el acceso a fotos para guardar el QR.');
      }
      const uri = await temporaryQrFile();
      await Asset.create(uri);
      setNotice('QR guardado en las fotos del celular.');
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'No se pudo guardar el QR.');
    } finally {
      setExporting(null);
    }
  }

  async function share() {
    setExporting('share');
    setError('');
    setNotice('');
    try {
      if (!await Sharing.isAvailableAsync()) {
        throw new Error('La opción de compartir no está disponible en este dispositivo.');
      }
      await Sharing.shareAsync(await temporaryQrFile(), {
        dialogTitle: `QR de asistencia · ${selectedStore?.name ?? 'Tienda'}`,
        mimeType: 'image/png',
        UTI: 'public.png',
      });
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'No se pudo compartir el QR.');
    } finally {
      setExporting(null);
    }
  }

  if (loading) return <ActivityIndicator color="#B4232D" size="large" style={styles.loader} />;

  return <ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.title}>QR de asistencia</Text>
    <Text style={styles.subtitle}>Muestra o imprime este código en la tienda. Al renovarlo, el código anterior deja de funcionar.</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    <Menu
      anchor={<Pressable onPress={() => setMenuVisible(true)} style={styles.selector}><View><Text style={styles.label}>Tienda</Text><Text style={styles.value}>{selectedStore?.name ?? 'Seleccionar tienda'}</Text></View><Icon source="chevron-down" size={22} color="#60706E" /></Pressable>}
      onDismiss={() => setMenuVisible(false)}
      visible={menuVisible}
    >
      {stores.map((store) => <Menu.Item key={store.id} onPress={() => { setStoreId(store.id); setMenuVisible(false); }} title={`${store.code} · ${store.name}`} />)}
    </Menu>
    <View style={styles.card}>
      {payload ? <>
        <View style={styles.qr}>
          <QRCode backgroundColor="#FFFFFF" color="#172423" getRef={(ref) => { qrRef.current = ref as QrSvgRef; }} quietZone={16} size={250} value={payload} />
        </View>
        <Text style={styles.ready}>Código listo para usar</Text>
        <Text style={styles.cardHelp}>Puedes descargarlo en PNG, guardarlo en las fotos del celular o compartirlo para imprimir.</Text>
        <View style={styles.actions}>
          <Button icon="download" loading={exporting === 'download'} mode="contained" onPress={() => void download()} style={styles.actionButton}>Descargar QR</Button>
          {Platform.OS !== 'web' ? <Button icon="share-variant" loading={exporting === 'share'} mode="outlined" onPress={() => void share()} style={styles.actionButton}>Compartir</Button> : null}
        </View>
      </> : <>
        <Icon source={configured ? 'qrcode-edit' : 'qrcode-plus'} color="#60706E" size={72} />
        <Text style={styles.cardTitle}>{configured ? 'Este QR necesita una renovación' : 'Esta tienda aún no tiene QR'}</Text>
        <Text style={styles.cardHelp}>{configured ? 'Fue creado antes de habilitar la descarga y no puede reconstruirse desde su hash. Renuévalo una vez para volver a mostrarlo y descargarlo.' : 'Genera el primer código para habilitar las marcaciones.'}</Text>
      </>}
      {rotatedAt ? <Text style={styles.rotated}>Última renovación: {new Date(rotatedAt).toLocaleString('es-PE')}</Text> : null}
      <Button buttonColor={payload ? undefined : '#FF4D4D'} icon="refresh" loading={saving} mode={payload ? 'outlined' : 'contained'} onPress={() => void rotate()}>{configured ? 'Renovar código QR' : 'Generar QR'}</Button>
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
  selector: { marginTop: 22, minHeight: 64, padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#879692', borderRadius: 10, backgroundColor: '#FFFFFF' },
  label: { color: '#60706E', fontSize: 10 },
  value: { marginTop: 4, color: '#172423', fontSize: 14, fontWeight: '800' },
  card: { marginTop: 22, padding: 28, alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 14, backgroundColor: '#FFFFFF' },
  qr: { padding: 10, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 12, backgroundColor: '#FFFFFF' },
  ready: { color: '#247451', fontSize: 15, fontWeight: '900' },
  cardTitle: { color: '#172423', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  cardHelp: { maxWidth: 430, color: '#60706E', fontSize: 11, lineHeight: 17, textAlign: 'center' },
  rotated: { color: '#60706E', fontSize: 10 },
  actions: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  actionButton: { minWidth: 160 },
});
