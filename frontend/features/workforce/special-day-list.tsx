import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Icon, SegmentedButtons, Switch, Text, TextInput } from 'react-native-paper';
import { api, apiErrorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import type { SpecialDay } from './workforce-types';

export function SpecialDayList() {
  const { user } = useAuth();
  const [days, setDays] = useState<SpecialDay[]>([]);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [percentage, setPercentage] = useState<'50' | '100'>('100');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const canManage = Boolean(user?.permissions?.includes('payroll.manage'));

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const response = await api.get('/special-days'); setDays(response.data.data ?? []); }
    catch (requestError) { setError(apiErrorMessage(requestError, 'No se pudieron cargar los días especiales.')); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function create() {
    if (!name.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError('Completa el nombre y una fecha válida con formato AAAA-MM-DD.'); return; }
    setSaving(true); setError('');
    try {
      await api.post('/special-days', { name: name.trim(), date, bonus_percentage: Number(percentage) });
      setName(''); setDate(''); setPercentage('100'); await load();
    } catch (requestError) { setError(apiErrorMessage(requestError, 'No se pudo crear el día especial.')); }
    finally { setSaving(false); }
  }

  async function toggle(day: SpecialDay) {
    setSaving(true); setError('');
    try { await api.put(`/special-days/${day.id}`, { ...day, is_active: !day.is_active }); await load(); }
    catch (requestError) { setError(apiErrorMessage(requestError, 'No se pudo actualizar el día especial.')); }
    finally { setSaving(false); }
  }

  async function remove(day: SpecialDay) {
    setSaving(true); setError('');
    try { await api.delete(`/special-days/${day.id}`); await load(); }
    catch (requestError) { setError(apiErrorMessage(requestError, 'No se pudo eliminar el día especial.')); }
    finally { setSaving(false); }
  }

  return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View><Text style={styles.title}>Días especiales</Text><Text style={styles.subtitle}>Configura una recompensa adicional basada en la proporción de la jornada registrada.</Text></View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {canManage ? <View style={styles.formCard}>
      <Text style={styles.sectionTitle}>Nuevo día especial</Text>
      <View style={styles.fields}><TextInput label="Nombre" mode="outlined" multiline={false} numberOfLines={1} onChangeText={setName} style={styles.field} value={name} /><TextInput label="Fecha" mode="outlined" multiline={false} numberOfLines={1} onChangeText={setDate} placeholder="AAAA-MM-DD" style={styles.field} value={date} /></View>
      <View><Text style={styles.label}>Recompensa sobre el valor diario trabajado</Text><SegmentedButtons buttons={[{ value: '50', label: '50%' }, { value: '100', label: '100%' }]} onValueChange={(value) => setPercentage(value as '50' | '100')} value={percentage} /></View>
      <Button buttonColor="#B4232D" disabled={saving} loading={saving} mode="contained" onPress={() => void create()}>Agregar día especial</Button>
    </View> : null}
    <View style={styles.listHeader}><Text style={styles.sectionTitle}>Calendario configurado</Text><Text style={styles.count}>{days.length}</Text></View>
    {loading ? <ActivityIndicator color="#B4232D" size="large" /> : <View style={styles.list}>{days.map((day) => <View key={day.id} style={[styles.dayCard, !day.is_active && styles.dayCardInactive]}><View style={styles.dayIcon}><Icon color="#B4232D" size={22} source="calendar-star" /></View><View style={styles.dayCopy}><Text style={styles.dayName}>{day.name}</Text><Text style={styles.dayMeta}>{day.date} · Recompensa {day.bonus_percentage}% proporcional</Text></View>{canManage ? <View style={styles.actions}><Switch disabled={saving} onValueChange={() => void toggle(day)} value={day.is_active} /><Button compact disabled={saving} icon="trash-can-outline" onPress={() => void remove(day)} textColor="#8F1D2C">Eliminar</Button></View> : <Text style={styles.status}>{day.is_active ? 'Activo' : 'Inactivo'}</Text>}</View>)}</View>}
    {!loading && days.length === 0 ? <View style={styles.empty}><Icon color="#60706E" size={42} source="calendar-blank-outline" /><Text style={styles.emptyTitle}>Sin días especiales</Text><Text style={styles.emptyText}>Agrega una fecha para aplicar recompensas del 50% o 100% según la asistencia.</Text></View> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 20, paddingBottom: 60, gap: 20 }, title: { color: '#172423', fontSize: 24, fontWeight: '900' }, subtitle: { marginTop: 6, color: '#60706E', fontSize: 12, lineHeight: 18 }, error: { padding: 12, borderRadius: 8, color: '#8F1D2C', backgroundColor: '#FCE8EA' }, formCard: { padding: 18, gap: 16, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 12, backgroundColor: '#FFFFFF' }, sectionTitle: { color: '#172423', fontSize: 16, fontWeight: '900' }, fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, field: { flex: 1, minWidth: 220, minHeight: 56, maxHeight: 56 }, label: { marginBottom: 8, color: '#60706E', fontSize: 11, fontWeight: '800' }, listHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 }, count: { paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden', borderRadius: 10, color: '#B4232D', backgroundColor: '#FFE5E5', fontSize: 10, fontWeight: '900' }, list: { gap: 10 }, dayCard: { minHeight: 72, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 10, backgroundColor: '#FFFFFF' }, dayCardInactive: { opacity: 0.55 }, dayIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#FFE5E5' }, dayCopy: { flex: 1 }, dayName: { color: '#172423', fontSize: 13, fontWeight: '800' }, dayMeta: { marginTop: 4, color: '#60706E', fontSize: 10 }, actions: { flexDirection: 'row', alignItems: 'center', gap: 5 }, status: { color: '#60706E', fontSize: 11 }, empty: { padding: 36, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 12, backgroundColor: '#FFFFFF' }, emptyTitle: { color: '#172423', fontWeight: '900' }, emptyText: { maxWidth: 420, color: '#60706E', fontSize: 11, lineHeight: 17, textAlign: 'center' },
});
