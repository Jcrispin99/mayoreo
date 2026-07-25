import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Icon, Menu, Switch, Text, TextInput } from 'react-native-paper';
import { ModuleLayout } from '../../components/module/module-layout';
import { getVisibleMenu } from '../../config/menu';
import { api } from '../../lib/api';
import type { DocumentSeries, PosDocumentType } from './pos-types';

type Props = { documentSeriesId?: string };
const POS_MODULE = getVisibleMenu().find((module) => module.id === 'pos');
const TYPES: { id: PosDocumentType; label: string }[] = [
  { id: 'sales_ticket', label: 'Nota de venta' },
  { id: 'receipt', label: 'Boleta' },
  { id: 'invoice', label: 'Factura' },
];

function requestErrorMessage(error: any) {
  const validationErrors = error?.response?.data?.errors;
  const first = validationErrors ? Object.values(validationErrors).flat()[0] : null;
  return typeof first === 'string' ? first : error?.response?.data?.message ?? 'No se pudo guardar la serie.';
}

export function DocumentSeriesForm({ documentSeriesId }: Props) {
  const editing = Boolean(documentSeriesId);
  const [type, setType] = useState<PosDocumentType>('sales_ticket');
  const [code, setCode] = useState('');
  const [currentNumber, setCurrentNumber] = useState('0');
  const [active, setActive] = useState(true);
  const [typeMenuVisible, setTypeMenuVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const locked = editing && Number(currentNumber) > 0;

  useEffect(() => {
    async function load() {
      if (!documentSeriesId) { setLoading(false); return; }
      try {
        const response = await api.get(`/document-series/${documentSeriesId}`);
        const series: DocumentSeries = response.data.data;
        setType(series.document_type);
        setCode(series.series_code);
        setCurrentNumber(String(series.current_number));
        setActive(series.is_active);
      } catch (requestError) {
        setError(requestErrorMessage(requestError));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [documentSeriesId]);

  async function save() {
    if (!code.trim()) { setError('Ingresa el código de la serie.'); return; }
    setSaving(true);
    setError('');
    const payload = { document_type: type, series_code: code.trim().toUpperCase(), current_number: Number(currentNumber), is_active: active };
    try {
      if (editing) await api.put(`/document-series/${documentSeriesId}`, payload);
      else await api.post('/document-series', payload);
      router.back();
    } catch (requestError) {
      setError(requestErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  if (!POS_MODULE) return null;

  return (
    <ModuleLayout module={POS_MODULE} selectedItemId="document-series">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        {loading ? <ActivityIndicator color="#B4232D" size="large" style={styles.loader} /> : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Button compact icon="arrow-left" mode="text" onPress={() => router.back()}>Volver</Button>
              <Button buttonColor="#FF4D4D" compact disabled={saving} loading={saving} mode="contained" onPress={() => void save()}>Guardar</Button>
            </View>
            <Text style={styles.title}>{editing ? 'Editar serie' : 'Nueva serie'}</Text>
            <Text style={styles.subtitle}>Configura una serie de venta y su correlativo inicial.</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.card}>
              <Menu
                anchor={(
                  <Pressable disabled={locked} onPress={() => setTypeMenuVisible(true)} style={[styles.selector, locked && styles.disabled]}>
                    <View><Text style={styles.label}>Tipo de documento *</Text><Text style={styles.value}>{TYPES.find((item) => item.id === type)?.label}</Text></View>
                    <Icon source="chevron-down" size={22} color="#60706E" />
                  </Pressable>
                )}
                onDismiss={() => setTypeMenuVisible(false)}
                visible={typeMenuVisible}
              >
                {TYPES.map((item) => <Menu.Item key={item.id} onPress={() => { setType(item.id); setTypeMenuVisible(false); }} title={item.label} />)}
              </Menu>
              <TextInput activeOutlineColor="#B4232D" autoCapitalize="characters" disabled={locked} label="Serie *" mode="outlined" onChangeText={setCode} outlineColor="#879692" style={styles.input} value={code} />
              <TextInput activeOutlineColor="#B4232D" disabled={locked} keyboardType="number-pad" label="Último correlativo *" mode="outlined" onChangeText={(value) => setCurrentNumber(value.replace(/\D/g, '') || '0')} outlineColor="#879692" style={styles.input} value={currentNumber} />
              <View style={styles.status}><View><Text style={styles.statusTitle}>Serie activa</Text><Text style={styles.statusHelp}>Solo las series activas pueden asignarse a una caja.</Text></View><Switch color="#B4232D" onValueChange={setActive} value={active} /></View>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </ModuleLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' }, loader: { flex: 1 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 48, gap: 15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#172423', fontSize: 25, fontWeight: '900' }, subtitle: { marginTop: -10, color: '#60706E', fontSize: 13 },
  error: { padding: 12, borderRadius: 10, color: '#8F1D2C', backgroundColor: '#FCE8EA', fontSize: 12, fontWeight: '700' },
  card: { padding: 18, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 14, backgroundColor: '#FFFFFF', gap: 16 },
  selector: { minHeight: 62, paddingHorizontal: 14, borderWidth: 1, borderColor: '#879692', borderRadius: 5, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  disabled: { opacity: 0.55, backgroundColor: '#EAEFEE' }, label: { color: '#60706E', fontSize: 10, fontWeight: '800' }, value: { marginTop: 3, color: '#172423', fontSize: 14, fontWeight: '700' },
  input: { height: 56, backgroundColor: '#FFFFFF' }, status: { padding: 14, borderRadius: 10, backgroundColor: '#EAEFEE', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 14 },
  statusTitle: { color: '#172423', fontSize: 13, fontWeight: '800' }, statusHelp: { marginTop: 3, color: '#60706E', fontSize: 10 },
});
