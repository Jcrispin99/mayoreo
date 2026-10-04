import axios from 'axios';
import * as Linking from 'expo-linking';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { api } from '../../lib/api';
import { COLORS } from '../../theme/colors';

type FiscalDocumentActionsProps = {
  documentId: number;
  initialPhone?: string | null;
};

type Representation = {
  html: string;
  filename: string;
};

function openWebRepresentation(representation: Representation) {
  const preview = window.open('', '_blank');
  if (!preview) throw new Error('El navegador bloqueó la ventana del comprobante.');

  preview.opener = null;
  preview.document.open();
  preview.document.write(representation.html);
  preview.document.close();
  preview.setTimeout(() => preview.print(), 250);
}

function requestErrorMessage(requestError: unknown, fallback: string) {
  if (!axios.isAxiosError(requestError)) {
    return requestError instanceof Error ? requestError.message : fallback;
  }
  const errors = requestError.response?.data?.errors as Record<string, string | string[]> | undefined;
  const firstError = errors ? Object.values(errors).flat()[0] : null;

  if (typeof firstError === 'string') return firstError;
  return typeof requestError.response?.data?.message === 'string'
    ? requestError.response.data.message
    : fallback;
}

export function FiscalDocumentActions({
  documentId,
  initialPhone = '',
}: FiscalDocumentActionsProps) {
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [busy, setBusy] = useState<'print' | 'share' | 'whatsapp' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setPhone(initialPhone ?? '');
    setError('');
    setNotice('');
  }, [documentId, initialPhone]);

  async function loadRepresentation(): Promise<Representation> {
    const response = await api.get(`/fiscal-documents/${documentId}/representation`);
    return response.data.data as Representation;
  }

  async function printDocument() {
    setBusy('print');
    setError('');
    setNotice('');
    try {
      const representation = await loadRepresentation();
      if (Platform.OS === 'web') {
        openWebRepresentation(representation);
        return;
      }

      await Print.printAsync({ html: representation.html });
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'No se pudo preparar la impresión.'));
    } finally {
      setBusy(null);
    }
  }

  async function sharePdf() {
    setBusy('share');
    setError('');
    setNotice('');
    try {
      const representation = await loadRepresentation();
      if (Platform.OS === 'web') {
        openWebRepresentation(representation);
        return;
      }

      if (!await Sharing.isAvailableAsync()) {
        setError('Este dispositivo no permite compartir archivos. Puedes usar Imprimir.');
        return;
      }

      const pdf = await Print.printToFileAsync({ html: representation.html });
      await Sharing.shareAsync(pdf.uri, {
        dialogTitle: `Compartir ${representation.filename}`,
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
      });
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'No se pudo generar el PDF.'));
    } finally {
      setBusy(null);
    }
  }

  async function sendWhatsApp() {
    if (!phone.trim()) {
      setError('Ingresa el número de WhatsApp del cliente.');
      return;
    }

    setBusy('whatsapp');
    setError('');
    setNotice('');
    try {
      const response = await api.post(`/fiscal-documents/${documentId}/deliveries`, {
        phone: phone.trim(),
      });
      const delivery = response.data.data as { phone: string; whatsapp_url: string };
      setPhone(delivery.phone);
      await Linking.openURL(delivery.whatsapp_url);
      setNotice('WhatsApp abierto con el enlace del comprobante. Confirma el envío en la conversación.');
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'No se pudo abrir WhatsApp.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Entregar comprobante</Text>
      <Text style={styles.help}>Puedes imprimirlo, compartir el PDF o enviarlo a un número por WhatsApp.</Text>
      <View style={styles.documentActions}>
        <Button
          disabled={busy !== null}
          icon="printer-outline"
          loading={busy === 'print'}
          mode="outlined"
          onPress={() => void printDocument()}
          style={styles.actionButton}
        >
          Imprimir
        </Button>
        <Button
          disabled={busy !== null}
          icon="file-pdf-box"
          loading={busy === 'share'}
          mode="outlined"
          onPress={() => void sharePdf()}
          style={styles.actionButton}
        >
          {Platform.OS === 'web' ? 'Guardar PDF' : 'Compartir PDF'}
        </Button>
      </View>
      <TextInput
        disabled={busy !== null}
        keyboardType="phone-pad"
        label="Número de WhatsApp"
        left={<TextInput.Icon icon="whatsapp" />}
        mode="outlined"
        onChangeText={(value) => {
          setPhone(value);
          setError('');
          setNotice('');
        }}
        placeholder="987 654 321"
        value={phone}
      />
      <Button
        buttonColor="#247451"
        disabled={busy !== null || !phone.trim()}
        icon="whatsapp"
        loading={busy === 'whatsapp'}
        mode="contained"
        onPress={() => void sendWhatsApp()}
      >
        Enviar por WhatsApp
      </Button>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
  },
  title: { color: COLORS.text, fontSize: 15, fontWeight: '900' },
  help: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16 },
  documentActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionButton: { flexGrow: 1 },
  error: { color: COLORS.error, fontSize: 11, fontWeight: '700' },
  notice: { color: '#247451', fontSize: 11, fontWeight: '700', lineHeight: 16 },
});
