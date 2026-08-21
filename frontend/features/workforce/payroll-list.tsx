import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { DataTable, type DataTableColumn } from '../../components/data/data-table';
import { ListToolbar } from '../../components/data/list-toolbar';
import { api, apiErrorMessage } from '../../lib/api';
import { currentBusinessMonth } from '../../lib/date-time';
import type { PayrollPeriod } from './workforce-types';

const PAGE_SIZE = 20;

export function PayrollList() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const filterOptions = [{ id: 'open', label: 'Abiertos', group: 'Estado' }, { id: 'closed', label: 'Cerrados', group: 'Estado' }];

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try { const response = await api.get('/payroll-periods'); setPeriods(response.data.data ?? []); }
    catch (requestError) { setError(apiErrorMessage(requestError, 'No se pudieron cargar las planillas.')); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const filtered = useMemo(() => periods.filter((period) => {
    const text = `${period.starts_on} ${period.ends_on}`;
    return text.includes(query.trim()) && (filters.length === 0 || filters.includes(period.status));
  }), [filters, periods, query]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  async function createCurrentMonth() {
    setCreating(true); setError('');
    try {
      const { startsOn, endsOn } = currentBusinessMonth();
      const response = await api.post('/payroll-periods', { starts_on: startsOn, ends_on: endsOn });
      router.push({ pathname: '/access/payroll/[periodId]', params: { periodId: String(response.data.data.id) } } as Href);
    } catch (requestError: any) { setError(requestError?.response?.data?.message ?? 'No se pudo crear la planilla del mes actual.'); }
    finally { setCreating(false); }
  }

  const columns = useMemo<DataTableColumn<PayrollPeriod>[]>(() => [{ key: 'period', title: 'Periodo', style: styles.main, renderCell: (period) => (
    <View><View style={styles.nameRow}><Text style={styles.name}>{new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${period.starts_on}T12:00:00Z`))}</Text><Text style={[styles.badge, period.status === 'closed' ? styles.closed : styles.open]}>{period.status === 'closed' ? 'Cerrada' : 'Abierta'}</Text></View><Text style={styles.meta}>{period.starts_on} al {period.ends_on}</Text></View>
  ) }, { key: 'action', title: '', style: styles.action, renderCell: () => <Icon source="chevron-right" size={22} color="#60706E" /> }], []);

  return <View style={styles.screen}>
    <ListToolbar activeFilterIds={filters} createLabel={creating ? 'Creando…' : 'Planilla del mes'} filterOptions={filterOptions} onCreate={() => void createCurrentMonth()} onPageChange={setPage} onQueryChange={setQuery} onToggleFilter={(id) => setFilters((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} page={currentPage} pageSize={PAGE_SIZE} query={query} title="Planillas" totalItems={filtered.length} />
    <DataTable columns={columns} data={visible} emptyIcon="cash-multiple" emptyText="Crea el periodo del mes para calcular los pagos." emptyTitle="Sin planillas" error={error} keyExtractor={(item) => String(item.id)} loading={loading} onRefresh={() => void load(true)} onRetry={() => void load()} onRowPress={(period) => router.push({ pathname: '/access/payroll/[periodId]', params: { periodId: String(period.id) } } as Href)} refreshing={refreshing} rowStyle={styles.row} showHeader={false} />
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' }, row: { minHeight: 74, paddingHorizontal: 16 }, main: { flex: 1 }, action: { width: 40, alignItems: 'center' }, nameRow: { flexDirection: 'row', gap: 8, alignItems: 'center' }, name: { color: '#172423', fontSize: 14, fontWeight: '800', textTransform: 'capitalize' }, meta: { marginTop: 5, color: '#60706E', fontSize: 11 }, badge: { overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, fontSize: 9, fontWeight: '800' }, open: { color: '#246B81', backgroundColor: '#E1F2F6' }, closed: { color: '#247451', backgroundColor: '#E0F3EA' },
});
