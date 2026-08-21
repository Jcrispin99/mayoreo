import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Icon, Text } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { api } from '../../lib/api';
import { formatBusinessTime } from '../../lib/date-time';
import { getPersistentDeviceId } from '../../lib/device-session';
import type { AttendanceShift } from './workforce-types';

export function AttendanceMarkScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [shift, setShift] = useState<AttendanceShift | null>(null);
  const [scanned, setScanned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    try { const response = await api.get('/attendance/status'); setShift(response.data.data.current_shift ?? null); }
    catch { setError('No se pudo consultar tu estado de asistencia.'); }
  }, []);
  useFocusEffect(useCallback(() => { void loadStatus(); }, [loadStatus]));
  useEffect(() => { if (!scanned) { setMessage(''); setError(''); } }, [scanned]);

  async function handleScan(result: BarcodeScanningResult) {
    if (scanned || submitting || !result.data.trim()) return;
    setScanned(true); setSubmitting(true); setError('');
    try {
      const deviceId = await getPersistentDeviceId();
      const response = await api.post('/attendance/scan', { qr_payload: result.data.trim(), device_id: deviceId });
      setShift(response.data.data.action === 'entry' ? response.data.data.shift : null);
      setMessage(response.data.message);
    } catch (requestError: any) { setError(requestError?.response?.data?.message ?? 'No se pudo registrar la marcación.'); }
    finally { setSubmitting(false); }
  }

  if (!permission) return <ActivityIndicator color="#B4232D" size="large" style={styles.loader} />;
  if (!permission.granted) return <View style={styles.center}><Icon source="camera-outline" size={60} color="#B4232D" /><Text style={styles.title}>Permiso de cámara requerido</Text><Text style={styles.help}>La cámara se utiliza únicamente para leer el QR de la tienda.</Text><Button buttonColor="#FF4D4D" mode="contained" onPress={() => permission.canAskAgain ? void requestPermission() : void Linking.openSettings()}>{permission.canAskAgain ? 'Permitir cámara' : 'Abrir configuración'}</Button></View>;

  return <View style={styles.screen}>
    <View style={styles.status}><Text style={styles.statusLabel}>Estado actual</Text><Text style={styles.statusValue}>{shift ? `Trabajando desde ${formatBusinessTime(shift.clocked_in_at)}` : 'Fuera del trabajo'}</Text><Text style={styles.statusHelp}>{shift ? 'El próximo escaneo registrará tu salida.' : 'El próximo escaneo registrará tu entrada.'}</Text></View>
    <View style={styles.cameraWrap}><CameraView barcodeScannerSettings={{ barcodeTypes: ['qr'] }} facing="back" onBarcodeScanned={scanned ? undefined : (result) => void handleScan(result)} style={styles.camera} /><View pointerEvents="none" style={styles.overlay}><View style={styles.frame} /></View></View>
    <View style={styles.result}>{submitting ? <ActivityIndicator color="#B4232D" /> : null}{message ? <Text style={styles.success}>{message}</Text> : null}{error ? <Text style={styles.error}>{error}</Text> : null}{scanned && !submitting ? <Button icon="qrcode-scan" mode="outlined" onPress={() => setScanned(false)}>Escanear nuevamente</Button> : <Text style={styles.instructions}>Apunta la cámara al QR de asistencia de tu tienda.</Text>}</View>
  </View>;
}

const styles = StyleSheet.create({
  loader: { flex: 1 }, screen: { flex: 1, backgroundColor: '#12171A' }, center: { flex: 1, padding: 30, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: '#F3F6F5' }, title: { color: '#172423', fontSize: 19, fontWeight: '900' }, help: { maxWidth: 340, color: '#60706E', textAlign: 'center' }, status: { padding: 18, backgroundColor: '#FFFFFF' }, statusLabel: { color: '#60706E', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }, statusValue: { marginTop: 4, color: '#172423', fontSize: 17, fontWeight: '900' }, statusHelp: { marginTop: 4, color: '#60706E', fontSize: 11 }, cameraWrap: { flex: 1, position: 'relative' }, camera: { flex: 1 }, overlay: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }, frame: { width: '72%', maxWidth: 330, aspectRatio: 1, borderWidth: 3, borderColor: '#FFFFFF', borderRadius: 18 }, result: { minHeight: 104, padding: 16, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFFFFF' }, success: { color: '#247451', fontSize: 16, fontWeight: '900' }, error: { color: '#8F1D2C', fontSize: 12, textAlign: 'center' }, instructions: { color: '#60706E', fontSize: 11, textAlign: 'center' },
});
