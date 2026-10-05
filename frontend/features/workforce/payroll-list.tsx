import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, Icon, Portal, SegmentedButtons, Text } from 'react-native-paper';
import { DataTable, type DataTableColumn } from '../../components/data/data-table';
import { ListToolbar } from '../../components/data/list-toolbar';
import { api, apiErrorMessage } from '../../lib/api';
import { currentBusinessMonth, currentBusinessWeek, formatBusinessDate } from '../../lib/date-time';
import { frequencyLabel } from './payroll-format';
import type { PayFrequency, PayrollPeriod } from './workforce-types';

const PAGE_SIZE = 20;
const FILTER_OPTIONS = [
  { id: 'open', label: 'Abiertas', group: 'Estado' },
  { id: 'closed', label: 'Cerradas', group: 'Estado' },
  { id: 'weekly', label: 'Semanales', group: 'Frecuencia' },
  { id: 'monthly', label: 'Mensuales', group: 'Frecuencia' },
];

function requestErrorMessage(error: any) {
  const validationErrors = error?.response?.data?.errors;
  const first = validationErrors ? Object.values(validationErrors).flat()[0] : null;
  return typeof first === 'string' ? first : error?.response?.data?.message ?? 'No se pudo crear la planilla.';
}

function periodTitle(period: PayrollPeriod) {
  if (period.pay_frequency === 'monthly') {
    return formatBusinessDate(period.starts_on, { month: 'long', year: 'numeric' });
  }

  return `Semana del ${formatBusinessDate(period.starts_on, { day: 'numeric', month: 'short' })}`;
}

export function PayrollList() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createDialogVisible, setCreateDialogVisible] = useState(false);
  const [frequency, setFrequency] = useState<PayFrequency>('weekly');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const response = await api.get('/payroll-periods');
      setPeriods(response.data.data ?? []);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'No se pudieron cargar las planillas.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const filtered = useMemo(() => periods.filter((period) => {
    const search = `${periodTitle(period)} ${frequencyLabel(period.pay_frequency)} ${period.starts_on} ${period.ends_on}`.toLocaleLowerCase('es');
    const statusFilters = filters.filter((id) => id === 'open' || id === 'closed');
    const frequencyFilters = filters.filter((id) => id === 'weekly' || id === 'monthly');
    const matchesStatus = statusFilters.length === 0 || statusFilters.includes(period.status);
    const matchesFrequency = frequencyFilters.length === 0 || frequencyFilters.includes(period.pay_frequency);
    return search.includes(query.trim().toLocaleLowerCase('es')) && matchesStatus && matchesFrequency;
  }), [filters, periods, query]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedRange = frequency === 'weekly' ? currentBusinessWeek() : currentBusinessMonth();

  async function createPeriod() {
    setCreating(true);
    setError('');
    try {
      const response = await api.post('/payroll-periods', {
        starts_on: selectedRange.startsOn,
        ends_on: selectedRange.endsOn,
        pay_frequency: frequency,
      });
      setCreateDialogVisible(false);
      router.push({ pathname: '/access/payroll/[periodId]', params: { periodId: String(response.data.data.id) } } as Href);
    } catch (requestError) {
      setError(requestErrorMessage(requestError));
      setCreateDialogVisible(false);
    } finally {
      setCreating(false);
    }
  }

  const columns = useMemo<DataTableColumn<PayrollPeriod>[]>(() => [{
    key: 'period', title: 'Periodo', style: styles.main, renderCell: (period) => (
      <View>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{periodTitle(period)}</Text>
          <Text style={[styles.badge, styles.frequency]}>{frequencyLabel(period.pay_frequency)}</Text>
          <Text style={[styles.badge, period.status === 'closed' ? styles.closed : styles.open]}>{period.status === 'closed' ? 'Cerrada' : 'Abierta'}</Text>
        </View>
        <Text style={styles.meta}>{formatBusinessDate(period.starts_on)} al {formatBusinessDate(period.ends_on)}</Text>
      </View>
    ),
  }, {
    key: 'action', title: '', style: styles.action, renderCell: () => <Icon source="chevron-right" size={22} color="#60706E" />,
  }], []);

  return <View style={styles.screen}>
    <ListToolbar
      activeFilterIds={filters}
      createLabel="Nueva planilla"
      filterOptions={FILTER_OPTIONS}
      onCreate={() => setCreateDialogVisible(true)}
      onPageChange={setPage}
      onQueryChange={(value) => { setQuery(value); setPage(1); }}
      onToggleFilter={(id) => { setFilters((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); setPage(1); }}
      page={currentPage}
      pageSize={PAGE_SIZE}
      query={query}
      title="Planillas"
      totalItems={filtered.length}
    />
    <DataTable
      columns={columns}
      data={visible}
      emptyIcon="cash-multiple"
      emptyText="Crea una planilla semanal o mensual para calcular el pago según las entradas y salidas."
      emptyTitle="Sin planillas"
      error={error}
      keyExtractor={(item) => String(item.id)}
      loading={loading}
      onRefresh={() => void load(true)}
      onRetry={() => void load()}
      onRowPress={(period) => router.push({ pathname: '/access/payroll/[periodId]', params: { periodId: String(period.id) } } as Href)}
      refreshing={refreshing}
      rowStyle={styles.row}
      showHeader={false}
    />
    <Portal>
      <Dialog dismissable={!creating} onDismiss={() => setCreateDialogVisible(false)} visible={createDialogVisible}>
        <Dialog.Icon icon="calculator-variant-outline" />
        <Dialog.Title style={styles.dialogTitle}>Crear planilla</Dialog.Title>
        <Dialog.Content>
          <Text style={styles.dialogHelp}>Selecciona la frecuencia. Se calcularán únicamente los trabajadores que tengan un sueldo vigente del mismo tipo.</Text>
          <SegmentedButtons
            buttons={[
              { value: 'weekly', label: 'Semanal', icon: 'calendar-week-outline' },
              { value: 'monthly', label: 'Mensual', icon: 'calendar-month-outline' },
            ]}
            onValueChange={(value) => setFrequency(value as PayFrequency)}
            style={styles.frequencySelector}
            value={frequency}
          />
          <View style={styles.periodPreview}>
            <Icon source="calendar-range-outline" color="#246B81" size={22} />
            <View style={styles.periodPreviewCopy}>
              <Text style={styles.periodPreviewTitle}>{frequency === 'weekly' ? 'Semana actual' : 'Mes actual'}</Text>
              <Text style={styles.periodPreviewText}>{formatBusinessDate(selectedRange.startsOn)} al {formatBusinessDate(selectedRange.endsOn)}</Text>
            </View>
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button disabled={creating} onPress={() => setCreateDialogVisible(false)}>Cancelar</Button>
          <Button buttonColor="#FF4D4D" loading={creating} mode="contained" onPress={() => void createPeriod()}>Calcular</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' }, row: { minHeight: 82, paddingHorizontal: 16, paddingVertical: 11 }, main: { flex: 1 }, action: { width: 40, alignItems: 'center' }, nameRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, alignItems: 'center' }, name: { color: '#172423', fontSize: 14, fontWeight: '800', textTransform: 'capitalize' }, meta: { marginTop: 6, color: '#60706E', fontSize: 11 }, badge: { overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, fontSize: 9, fontWeight: '800' }, frequency: { color: '#655021', backgroundColor: '#F7EBCB' }, open: { color: '#246B81', backgroundColor: '#E1F2F6' }, closed: { color: '#247451', backgroundColor: '#E0F3EA' }, dialogTitle: { textAlign: 'center' }, dialogHelp: { color: '#60706E', fontSize: 12, lineHeight: 18 }, frequencySelector: { marginTop: 18 }, periodPreview: { marginTop: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 10, backgroundColor: '#E1F2F6' }, periodPreviewCopy: { flex: 1 }, periodPreviewTitle: { color: '#246B81', fontSize: 12, fontWeight: '900' }, periodPreviewText: { marginTop: 3, color: '#246B81', fontSize: 11 },
});
