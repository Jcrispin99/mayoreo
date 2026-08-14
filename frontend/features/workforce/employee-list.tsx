import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { DataTable, type DataTableColumn } from '../../components/data/data-table';
import { ListToolbar } from '../../components/data/list-toolbar';
import { api, apiErrorMessage } from '../../lib/api';
import type { EmployeeProfile } from './workforce-types';

const PAGE_SIZE = 20;
const FILTERS = [
  { id: 'active', label: 'Activos', group: 'Estado' },
  { id: 'inactive', label: 'Inactivos', group: 'Estado' },
  { id: 'working', label: 'Trabajando ahora', group: 'Asistencia' },
];

function payLabel(employee: EmployeeProfile) {
  const compensation = employee.compensations?.[0];
  if (!compensation) return 'Sueldo no visible';
  return `${compensation.pay_type === 'monthly' ? 'Mensual' : 'Diario'} · S/ ${Number(compensation.amount).toFixed(2)}`;
}

export function EmployeeList() {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const response = await api.get('/employees');
      setEmployees(response.data.data ?? []);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'No se pudo cargar el personal.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const filtered = useMemo(() => employees.filter((employee) => {
    const search = `${employee.user.name} ${employee.user.email} ${employee.store?.name ?? ''}`.toLocaleLowerCase('es');
    const matchesQuery = search.includes(query.trim().toLocaleLowerCase('es'));
    const statusFilters = filters.filter((id) => id === 'active' || id === 'inactive');
    const matchesStatus = statusFilters.length === 0 || statusFilters.includes(employee.employment_status);
    const matchesWorking = !filters.includes('working') || Boolean(employee.current_shift);
    return matchesQuery && matchesStatus && matchesWorking;
  }), [employees, filters, query]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const columns = useMemo<DataTableColumn<EmployeeProfile>[]>(() => [{
    key: 'employee', title: 'Trabajador', style: styles.mainColumn, renderCell: (employee) => (
      <View>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{employee.user.name}</Text>
          <Text style={[styles.badge, employee.current_shift ? styles.working : styles.out]}>
            {employee.current_shift ? 'Trabajando' : employee.employment_status === 'active' ? 'Fuera' : 'Inactivo'}
          </Text>
        </View>
        <Text style={styles.meta}>{employee.store?.name ?? 'Sin tienda'} · {payLabel(employee)}</Text>
        <Text style={styles.meta}>{Math.round(employee.expected_minutes_per_day / 60)} h esperadas · {employee.work_days.length} días/semana</Text>
      </View>
    ),
  }, {
    key: 'action', title: '', style: styles.actionColumn, renderCell: () => <Icon source="chevron-right" size={22} color="#60706E" />,
  }], []);

  return (
    <View style={styles.screen}>
      <ListToolbar
        activeFilterIds={filters}
        filterOptions={FILTERS}
        onCreate={() => router.push({ pathname: '/access/[resource]/new', params: { resource: 'users' } } as Href)}
        createLabel="Crear usuario"
        onPageChange={setPage}
        onQueryChange={(value) => { setQuery(value); setPage(1); }}
        onToggleFilter={(id) => { setFilters((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); setPage(1); }}
        page={currentPage}
        pageSize={PAGE_SIZE}
        query={query}
        title="Trabajadores"
        totalItems={filtered.length}
      />
      <DataTable
        columns={columns}
        data={visible}
        emptyIcon="account-hard-hat-outline"
        emptyText="Configura los datos laborales desde la ficha de un usuario."
        emptyTitle="Aún no hay trabajadores"
        error={error}
        keyExtractor={(item) => String(item.id)}
        loading={loading}
        onRefresh={() => void load(true)}
        onRetry={() => void load()}
        onRowPress={(employee) => router.push({ pathname: '/access/[resource]/[itemId]', params: { resource: 'users', itemId: String(employee.user_id) } } as Href)}
        refreshing={refreshing}
        rowStyle={styles.row}
        showHeader={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' }, row: { minHeight: 82, paddingHorizontal: 16, paddingVertical: 11 },
  mainColumn: { flex: 1 }, actionColumn: { width: 40, alignItems: 'center' }, nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, color: '#172423', fontSize: 14, fontWeight: '800' }, meta: { marginTop: 4, color: '#60706E', fontSize: 11 },
  badge: { overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, fontSize: 9, fontWeight: '800' },
  working: { color: '#247451', backgroundColor: '#E0F3EA' }, out: { color: '#60706E', backgroundColor: '#EAEFEE' },
});
