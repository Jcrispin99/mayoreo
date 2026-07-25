import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { DataTable, type DataTableColumn } from '../../components/data/data-table';
import { ListToolbar } from '../../components/data/list-toolbar';
import { api } from '../../lib/api';
import type { Supplier } from './purchase-types';

const PAGE_SIZE = 20;
const STATUS_FILTERS = [
  { id: 'active', label: 'Activos', group: 'Estado' },
  { id: 'inactive', label: 'Inactivos', group: 'Estado' },
];

export function SupplierList() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [query, setQuery] = useState('');
  const [activeFilterIds, setActiveFilterIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadSuppliers = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const response = await api.get('/suppliers');
      setSuppliers(response.data.data ?? []);
    } catch {
      setError('No se pudieron cargar los proveedores.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadSuppliers();
  }, [loadSuppliers]));

  const filteredSuppliers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es');
    const selectedStates = activeFilterIds.filter((id) => id === 'active' || id === 'inactive');

    return suppliers.filter((supplier) => {
      const searchText = `${supplier.name} ${supplier.document_number ?? ''} ${supplier.phone ?? ''} ${supplier.email ?? ''}`;
      const matchesQuery = !normalizedQuery || searchText.toLocaleLowerCase('es').includes(normalizedQuery);
      const matchesState = selectedStates.length === 0
        || (supplier.is_active ? selectedStates.includes('active') : selectedStates.includes('inactive'));
      return matchesQuery && matchesState;
    });
  }, [activeFilterIds, query, suppliers]);

  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleSuppliers = filteredSuppliers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const columns = useMemo<DataTableColumn<Supplier>[]>(() => [
    {
      key: 'detail',
      title: 'Detalle',
      style: styles.detailColumn,
      renderCell: (supplier) => (
        <View>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.name}>{supplier.name}</Text>
            {!supplier.is_active ? <Text style={styles.inactive}>Inactivo</Text> : null}
          </View>
          <Text numberOfLines={2} style={styles.meta}>
            {supplier.document_number || 'Sin documento'} · {supplier.phone || supplier.email || 'Sin datos de contacto'}
          </Text>
        </View>
      ),
    },
    {
      key: 'action',
      title: '',
      style: styles.actionColumn,
      renderCell: () => <Icon source="chevron-right" color="#60706E" size={22} />,
    },
  ], []);

  function openForm(supplier?: Supplier) {
    const pathname = supplier ? '/purchases/suppliers/[supplierId]' : '/purchases/suppliers/new';
    router.push({
      pathname,
      params: supplier ? { supplierId: String(supplier.id) } : {},
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
        onQueryChange={(value) => { setQuery(value); setPage(1); }}
        onToggleFilter={toggleFilter}
        page={currentPage}
        pageSize={PAGE_SIZE}
        query={query}
        title="Proveedores"
        totalItems={filteredSuppliers.length}
      />
      <DataTable
        columns={columns}
        data={visibleSuppliers}
        emptyIcon="truck-delivery-outline"
        emptyText={filtered ? 'Prueba con otro texto o cambia los filtros.' : 'Usa “Nuevo” para crear el primer proveedor.'}
        emptyTitle={filtered ? 'Sin resultados' : 'Aún no hay proveedores'}
        error={error}
        keyExtractor={(supplier) => String(supplier.id)}
        loading={loading}
        onRefresh={() => void loadSuppliers(true)}
        onRetry={() => void loadSuppliers()}
        onRowPress={openForm}
        refreshing={refreshing}
        rowAccessibilityLabel={(supplier) => `Editar ${supplier.name}`}
        rowStyle={styles.compactRow}
        showHeader={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' },
  compactRow: { minHeight: 68, paddingHorizontal: 16, paddingVertical: 9 },
  detailColumn: { flex: 1 },
  actionColumn: { width: 42, alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, color: '#172423', fontSize: 14, fontWeight: '800' },
  meta: { marginTop: 4, color: '#60706E', fontSize: 11, lineHeight: 15 },
  inactive: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7, color: '#60706E', backgroundColor: '#EAEFEE', fontSize: 9, fontWeight: '800' },
});
