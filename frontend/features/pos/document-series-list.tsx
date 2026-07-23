import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { DataTable, type DataTableColumn } from '../../components/data/data-table';
import { ListToolbar } from '../../components/data/list-toolbar';
import { api } from '../../lib/api';
import type { DocumentSeries, PosDocumentType } from './pos-types';

const TYPE_LABELS: Record<PosDocumentType, string> = {
  sales_ticket: 'Nota de venta',
  receipt: 'Boleta',
  invoice: 'Factura',
};
const STATUS_FILTERS = [
  { id: 'active', label: 'Activas', group: 'Estado' },
  { id: 'inactive', label: 'Inactivas', group: 'Estado' },
];

export function DocumentSeriesList() {
  const [items, setItems] = useState<DocumentSeries[]>([]);
  const [query, setQuery] = useState('');
  const [activeFilterIds, setActiveFilterIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadItems = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const response = await api.get('/document-series');
      setItems(response.data.data ?? []);
    } catch {
      setError('No se pudieron cargar las series de venta.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadItems(); }, [loadItems]));

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es');
    return items.filter((item) => {
      const matchesQuery = !normalized || `${item.series_code} ${TYPE_LABELS[item.document_type]}`.toLocaleLowerCase('es').includes(normalized);
      const matchesStatus = activeFilterIds.length === 0
        || (item.is_active ? activeFilterIds.includes('active') : activeFilterIds.includes('inactive'));
      return matchesQuery && matchesStatus;
    });
  }, [activeFilterIds, items, query]);

  const columns = useMemo<DataTableColumn<DocumentSeries>[]>(() => [
    {
      key: 'detail', title: 'Serie', style: styles.detailColumn, renderCell: (item) => (
        <View>
          <View style={styles.nameRow}>
            <Text style={styles.code}>{item.series_code}</Text>
            <Text style={styles.type}>{TYPE_LABELS[item.document_type]}</Text>
            {!item.is_active ? <Text style={styles.inactive}>Inactiva</Text> : null}
          </View>
          <Text style={styles.meta}>Último correlativo: {item.current_number} · Próximo: {item.next_number}</Text>
          <Text style={item.assigned_cash_register_id ? styles.assigned : styles.available}>
            {item.assigned_cash_register_id ? 'Asignada a una caja' : 'Disponible para asignar'}
          </Text>
        </View>
      ),
    },
    { key: 'action', title: '', style: styles.actionColumn, renderCell: () => <Icon source="chevron-right" color="#A49DA7" size={22} /> },
  ], []);

  function toggleFilter(filterId: string) {
    setActiveFilterIds((current) => current.includes(filterId) ? current.filter((id) => id !== filterId) : [...current, filterId]);
  }

  function openEdit(item: DocumentSeries) {
    router.push({ pathname: '/pos/document-series/[documentSeriesId]', params: { documentSeriesId: String(item.id) } } as Href);
  }

  return (
    <View style={styles.screen}>
      <ListToolbar
        activeFilterIds={activeFilterIds}
        filterOptions={STATUS_FILTERS}
        onCreate={() => router.push('/pos/document-series/new')}
        onPageChange={() => undefined}
        onQueryChange={setQuery}
        onToggleFilter={toggleFilter}
        page={1}
        pageSize={Math.max(1, filteredItems.length)}
        query={query}
        title="Series y correlativos"
        totalItems={filteredItems.length}
      />
      <DataTable
        columns={columns}
        data={filteredItems}
        emptyIcon="file-document-outline"
        emptyText="Crea una serie de venta para poder asignarla a una caja."
        emptyTitle="Aún no hay series de venta"
        error={error}
        keyExtractor={(item) => String(item.id)}
        loading={loading}
        onRefresh={() => void loadItems(true)}
        onRetry={() => void loadItems()}
        onRowPress={openEdit}
        refreshing={refreshing}
        rowAccessibilityLabel={(item) => `Editar serie ${item.series_code}`}
        rowStyle={styles.row}
        showHeader={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F5F8' },
  row: { minHeight: 82, paddingHorizontal: 16, paddingVertical: 10 },
  detailColumn: { flex: 1 },
  actionColumn: { width: 38, alignItems: 'center' },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  code: { color: '#302A33', fontSize: 14, fontWeight: '900' },
  type: { color: '#28738A', fontSize: 10, fontWeight: '800' },
  inactive: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7, color: '#925064', backgroundColor: '#F8E8ED', fontSize: 9, fontWeight: '800' },
  meta: { marginTop: 5, color: '#77717A', fontSize: 11 },
  assigned: { marginTop: 4, color: '#8A5A32', fontSize: 10, fontWeight: '700' },
  available: { marginTop: 4, color: '#168C6B', fontSize: 10, fontWeight: '700' },
});
