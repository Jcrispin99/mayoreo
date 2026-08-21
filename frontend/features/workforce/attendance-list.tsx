import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Icon, Text, TextInput } from 'react-native-paper';
import { DataTable, type DataTableColumn } from '../../components/data/data-table';
import { ListToolbar } from '../../components/data/list-toolbar';
import { api, apiErrorMessage } from '../../lib/api';
import { formatBusinessDateTime } from '../../lib/date-time';
import type { AttendanceShift } from './workforce-types';

const PAGE_SIZE = 25;
const FILTERS = [
  { id: 'open', label: 'Jornada abierta', group: 'Estado' },
  { id: 'completed', label: 'Completa', group: 'Estado' },
  { id: 'incident', label: 'Incidencia', group: 'Estado' },
];

function duration(minutes: number | null) {
  if (minutes === null) return 'En curso';
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function AttendanceList() {
  const [shifts, setShifts] = useState<AttendanceShift[]>([]);
  const [selected, setSelected] = useState<AttendanceShift | null>(null);
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try { const response = await api.get('/attendance-shifts'); setShifts(response.data.data ?? []); }
    catch (requestError) { setError(apiErrorMessage(requestError, 'No se pudo cargar la asistencia.')); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const filtered = useMemo(() => shifts.filter((shift) => {
    const search = `${shift.employee?.user.name ?? ''} ${shift.store?.name ?? ''}`.toLocaleLowerCase('es');
    return search.includes(query.trim().toLocaleLowerCase('es')) && (filters.length === 0 || filters.includes(shift.status));
  }), [filters, query, shifts]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function openCorrection(shift: AttendanceShift) {
    setSelected(shift);
    setClockIn(shift.clocked_in_at);
    setClockOut(shift.clocked_out_at ?? '');
    setReason('');
  }

  async function saveCorrection() {
    if (!selected || reason.trim().length < 5) return;
    setSaving(true);
    try {
      await api.patch(`/attendance-shifts/${selected.id}`, { clocked_in_at: clockIn, clocked_out_at: clockOut || null, reason: reason.trim() });
      setSelected(null);
      await load(true);
    } catch (requestError: any) { setError(requestError?.response?.data?.message ?? 'No se pudo corregir la asistencia.'); setSelected(null); }
    finally { setSaving(false); }
  }

  const columns = useMemo<DataTableColumn<AttendanceShift>[]>(() => [{
    key: 'shift', title: 'Asistencia', style: styles.mainColumn, renderCell: (shift) => (
      <View>
        <View style={styles.nameRow}><Text style={styles.name}>{shift.employee?.user.name ?? 'Trabajador'}</Text><Text style={[styles.badge, styles[shift.status]]}>{shift.status === 'open' ? 'En curso' : shift.status === 'completed' ? 'Completa' : 'Incidencia'}</Text></View>
        <Text style={styles.meta}>{shift.store?.name ?? 'Tienda'} · {duration(shift.worked_minutes)}</Text>
        <Text style={styles.times}>Entrada: {formatBusinessDateTime(shift.clocked_in_at)} · Salida: {formatBusinessDateTime(shift.clocked_out_at)}</Text>
      </View>
    ),
  }, { key: 'action', title: '', style: styles.action, renderCell: () => <Icon source="pencil-outline" color="#60706E" size={20} /> }], []);

  return <View style={styles.screen}>
    <ListToolbar activeFilterIds={filters} filterOptions={FILTERS} onPageChange={setPage} onQueryChange={(value) => { setQuery(value); setPage(1); }} onToggleFilter={(id) => setFilters((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} page={currentPage} pageSize={PAGE_SIZE} query={query} title="Asistencia" totalItems={filtered.length} />
    <DataTable columns={columns} data={visible} emptyIcon="calendar-clock-outline" emptyText="Las entradas y salidas aparecerán aquí." emptyTitle="Sin marcaciones" error={error} keyExtractor={(item) => String(item.id)} loading={loading} onRefresh={() => void load(true)} onRetry={() => void load()} onRowPress={openCorrection} refreshing={refreshing} rowStyle={styles.row} showHeader={false} />
    <Modal animationType="slide" onRequestClose={() => setSelected(null)} presentationStyle="pageSheet" visible={Boolean(selected)}>
      <ScrollView contentContainerStyle={styles.modal} keyboardShouldPersistTaps="handled">
        <Text style={styles.modalTitle}>Corregir asistencia</Text><Text style={styles.modalHelp}>Usa fecha ISO con zona horaria. El motivo quedará registrado en la auditoría.</Text>
        <TextInput label="Entrada" mode="outlined" onChangeText={setClockIn} value={clockIn} />
        <TextInput label="Salida (opcional)" mode="outlined" onChangeText={setClockOut} value={clockOut} />
        <TextInput label="Motivo obligatorio" mode="outlined" multiline onChangeText={setReason} value={reason} />
        <View style={styles.modalActions}><Button onPress={() => setSelected(null)}>Cancelar</Button><Button buttonColor="#FF4D4D" disabled={reason.trim().length < 5} loading={saving} mode="contained" onPress={() => void saveCorrection()}>Guardar</Button></View>
      </ScrollView>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' }, row: { minHeight: 88, paddingHorizontal: 16 }, mainColumn: { flex: 1 }, action: { width: 38, alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, name: { flexShrink: 1, color: '#172423', fontSize: 14, fontWeight: '800' }, meta: { marginTop: 5, color: '#60706E', fontSize: 11 }, times: { marginTop: 4, color: '#172423', fontSize: 10 },
  badge: { overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, fontSize: 9, fontWeight: '800' }, open: { color: '#246B81', backgroundColor: '#E1F2F6' }, completed: { color: '#247451', backgroundColor: '#E0F3EA' }, incident: { color: '#8F1D2C', backgroundColor: '#FCE8EA' },
  modal: { padding: 24, gap: 18 }, modalTitle: { color: '#172423', fontSize: 22, fontWeight: '900' }, modalHelp: { color: '#60706E', fontSize: 12, lineHeight: 18 }, modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
