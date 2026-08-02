import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { DataTable, type DataTableColumn } from '../../components/data/data-table';
import { ListToolbar } from '../../components/data/list-toolbar';
import { api, apiErrorMessage } from '../../lib/api';
import type { Customer } from './customer-types';

const PAGE_SIZE = 20;
const STATUS_FILTERS = [
  { id: 'active', label: 'Activos', group: 'Estado' },
  { id: 'inactive', label: 'Inactivos', group: 'Estado' },
];

export function CustomerList() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState('');
  const [activeFilterIds, setActiveFilterIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadCustomers = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');

    try {
      const response = await api.get('/customers');
      setCustomers(response.data.data ?? []);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'No se pudieron cargar los clientes.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadCustomers();
  }, [loadCustomers]));

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es');
    const selectedStates = activeFilterIds.filter((id) => id === 'active' || id === 'inactive');

    return customers.filter((customer) => {
      const searchText = [
        customer.name,
        customer.document_number,
        customer.phone,
        customer.email,
        customer.address,
      ].filter(Boolean).join(' ');
      const matchesQuery = !normalizedQuery
        || searchText.toLocaleLowerCase('es').includes(normalizedQuery);
      const matchesState = selectedStates.length === 0
        || (customer.is_active
          ? selectedStates.includes('active')
          : selectedStates.includes('inactive'));

      return matchesQuery && matchesState;
    });
  }, [activeFilterIds, customers, query]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleCustomers = filteredCustomers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const columns = useMemo<DataTableColumn<Customer>[]>(() => [
    {
      key: 'detail',
      title: 'Cliente',
      style: styles.detailColumn,
      renderCell: (customer) => (
        <View>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.name}>{customer.name}</Text>
            {!customer.is_active ? <Text style={styles.inactive}>Inactivo</Text> : null}
          </View>
          <Text numberOfLines={1} style={styles.meta}>
            {customer.document_number || 'Sin documento'}
            {' · '}
            {customer.phone || customer.email || 'Sin datos de contacto'}
          </Text>
          {customer.address ? (
            <Text numberOfLines={1} style={styles.address}>{customer.address}</Text>
          ) : null}
        </View>
      ),
    },
    {
      key: 'action',
      title: '',
      style: styles.actionColumn,
      renderCell: () => <Icon color="#60706E" size={22} source="chevron-right" />,
    },
  ], []);

  function openForm(customer?: Customer) {
    const pathname = customer ? '/customers/[customerId]' : '/customers/new';
    router.push({
      pathname,
      params: customer ? { customerId: String(customer.id) } : {},
    } as Href);
  }

  function toggleFilter(filterId: string) {
    setActiveFilterIds((current) => current.includes(filterId)
      ? current.filter((id) => id !== filterId)
      : [...current, filterId]);
    setPage(1);
  }

  const filtered = Boolean(query.trim()) || activeFilterIds.length > 0;

  return (
    <View style={styles.screen}>
      <ListToolbar
        activeFilterIds={activeFilterIds}
        filterOptions={STATUS_FILTERS}
        onCreate={() => openForm()}
        onPageChange={setPage}
        onQueryChange={(value) => {
          setQuery(value);
          setPage(1);
        }}
        onToggleFilter={toggleFilter}
        page={currentPage}
        pageSize={PAGE_SIZE}
        query={query}
        title="Clientes"
        totalItems={filteredCustomers.length}
      />
      <DataTable
        columns={columns}
        data={visibleCustomers}
        emptyIcon="account-multiple-outline"
        emptyText={
          filtered
            ? 'Prueba con otro texto o cambia los filtros.'
            : 'Usa “Nuevo” para registrar el primer cliente.'
        }
        emptyTitle={filtered ? 'Sin resultados' : 'Aún no hay clientes'}
        error={error}
        keyExtractor={(customer) => String(customer.id)}
        loading={loading}
        onRefresh={() => void loadCustomers(true)}
        onRetry={() => void loadCustomers()}
        onRowPress={openForm}
        refreshing={refreshing}
        rowAccessibilityLabel={(customer) => `Editar ${customer.name}`}
        rowStyle={styles.row}
        showHeader={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' },
  row: { minHeight: 74, paddingHorizontal: 16, paddingVertical: 10 },
  detailColumn: { flex: 1 },
  actionColumn: { width: 42, alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, color: '#172423', fontSize: 14, fontWeight: '800' },
  meta: { marginTop: 4, color: '#60706E', fontSize: 10 },
  address: { marginTop: 3, color: '#60706E', fontSize: 9 },
  inactive: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7, color: '#60706E', backgroundColor: '#EAEFEE', fontSize: 9, fontWeight: '800' },
});
