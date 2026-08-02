import { CameraView, useCameraPermissions, type BarcodeScanningResult, type BarcodeType } from 'expo-camera';
import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Icon, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

const PRODUCT_BARCODE_TYPES: BarcodeType[] = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'code93',
  'itf14',
  'codabar',
  'datamatrix',
];

type PosBarcodeScannerProps = {
  visible: boolean;
  onClose: () => void;
  onScanned: (barcode: string) => void;
};

export function PosBarcodeScanner({ visible, onClose, onScanned }: PosBarcodeScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [cameraError, setCameraError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setScanned(false);
    setCameraError('');
  }, [visible]);

  function handleBarcodeScanned(result: BarcodeScanningResult) {
    const barcode = result.data.trim();
    if (scanned || !barcode) return;

    setScanned(true);
    onScanned(barcode);
    onClose();
  }

  if (!visible) return null;

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" visible>
      <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Escanear producto</Text>
            <Text style={styles.subtitle}>Apunta la cámara al código de barras.</Text>
          </View>
          <Pressable
            accessibilityLabel="Cerrar lector de código de barras"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={styles.closeButton}
          >
            <Icon color="#FFFFFF" size={24} source="close" />
          </Pressable>
        </View>

        {!permission ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#FFFFFF" size="large" />
            <Text style={styles.statusText}>Preparando la cámara…</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.centered}>
            <View style={styles.permissionIcon}>
              <Icon color="#B4232D" size={38} source="camera-outline" />
            </View>
            <Text style={styles.permissionTitle}>Permiso de cámara requerido</Text>
            <Text style={styles.permissionText}>
              Necesitamos la cámara para leer el código de barras del producto.
            </Text>
            <Button
              buttonColor="#FF4D4D"
              icon="camera"
              mode="contained"
              onPress={() => {
                if (permission.canAskAgain) {
                  void requestPermission();
                } else {
                  void Linking.openSettings();
                }
              }}
            >
              {permission.canAskAgain ? 'Permitir cámara' : 'Abrir configuración'}
            </Button>
          </View>
        ) : cameraError ? (
          <View style={styles.centered}>
            <Icon color="#FFB3BD" size={42} source="camera-off-outline" />
            <Text style={styles.permissionTitle}>No se pudo iniciar la cámara</Text>
            <Text style={styles.permissionText}>{cameraError}</Text>
            <Button mode="outlined" onPress={onClose} textColor="#FFFFFF">Cerrar</Button>
          </View>
        ) : (
          <View style={styles.cameraContainer}>
            <CameraView
              barcodeScannerSettings={{ barcodeTypes: PRODUCT_BARCODE_TYPES }}
              facing="back"
              onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
              onMountError={(event) => setCameraError(event.message)}
              style={styles.camera}
            />
            <View pointerEvents="none" style={styles.overlay}>
              <View style={styles.scanFrame} />
              <View style={styles.instructions}>
                <Icon color="#FFFFFF" size={20} source="barcode-scan" />
                <Text style={styles.instructionsText}>Mantén el código dentro del recuadro</Text>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#12171A' },
  header: { minHeight: 72, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, backgroundColor: '#12171A' },
  title: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  subtitle: { marginTop: 3, color: '#AEB9BE', fontSize: 10 },
  closeButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: '#2A3236' },
  centered: { flex: 1, paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center', gap: 14 },
  statusText: { color: '#DCE4E7', fontSize: 11 },
  permissionIcon: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center', borderRadius: 35, backgroundColor: '#FFE5E5' },
  permissionTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  permissionText: { maxWidth: 340, color: '#B8C2C6', fontSize: 11, lineHeight: 17, textAlign: 'center' },
  cameraContainer: { flex: 1, position: 'relative', overflow: 'hidden' },
  camera: { flex: 1 },
  overlay: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: '82%', maxWidth: 380, aspectRatio: 1.8, borderWidth: 3, borderColor: '#FFFFFF', borderRadius: 16, backgroundColor: 'transparent' },
  instructions: { position: 'absolute', bottom: 42, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 20, backgroundColor: 'rgba(18, 23, 26, 0.76)' },
  instructionsText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
