import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { DataTable, type DataTableColumn } from '../../components/data/data-table';
import { ListToolbar } from '../../components/data/list-toolbar';
import { api, apiErrorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import type { InventoryTransfer, Warehouse } from './inventory-types';

const PAGE_SIZE = 20;
const STATUS = {
  draft: { label: 'Borrador', color: '#925300', backgroundColor: '#FFF1D6' },
  in_transit: { label: 'En tránsito', color: '#246B81', backgroundColor: '#E1F2F6' },
  received: { label: 'Recibido', color: '#247451', backgroundColor: '#E0F3EA' },
  cancelled: { label: 'Cancelado', color: '#8F1D2C', backgroundColor: '#FCE8EA' },
} as const;

const STATUS_FILTERS = Object.entries(STATUS).map(([id, value]) => ({
  id: `status:${id}`,
  label: value.label,
  group: 'Estado',
}));

export function InventoryTransferList() {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState<InventoryTransfer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [query, setQuery] = useState('');
  const [activeFilterIds, setActiveFilterIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const [transfersResponse, warehousesResponse] = await Promise.all([
        api.get('/inventory-transfers'),
        api.get('/warehouses'),
      ]);
      setTransfers(transfersResponse.data.data ?? []);
      setWarehouses(warehousesResponse.data.data ?? []);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'No se pudieron cargar los traslados.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const warehouseNames = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse.name])),
    [warehouses],
  );
  const filteredTransfers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es');
    const statuses = activeFilterIds
      .filter((id) => id.startsWith('status:'))
      .map((id) => id.replace('status:', ''));

    return transfers.filter((transfer) => {
      const searchText = `${transfer.id} ${warehouseNames.get(transfer.from_warehouse_id) ?? ''} ${warehouseNames.get(transfer.to_warehouse_id) ?? ''} ${transfer.notes ?? ''}`;
      return (!normalizedQuery || searchText.toLocaleLowerCase('es').includes(normalizedQuery))
        && (statuses.length === 0 || statuses.includes(transfer.status));
    });
  }, [activeFilterIds, query, transfers, warehouseNames]);
  const totalPages = Math.max(1, Math.ceil(filteredTransfers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleTransfers = filteredTransfers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const canManage = user !== null && (!user.permissions || user.permissions.includes('inventory-transfers.manage'));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const columns = useMemo<DataTableColumn<InventoryTransfer>[]>(() => [{
    key: 'detail',
    title: 'Traslado',
    style: styles.detailColumn,
    renderCell: (transfer) => {
      const status = STATUS[transfer.status];
      return (
        <View>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Traslado #{transfer.id}</Text>
            <Text style={[styles.status, { color: status.color, backgroundColor: status.backgroundColor }]}>{status.label}</Text>
          </View>
          <Text numberOfLines={1} style={styles.route}>{warehouseNames.get(transfer.from_warehouse_id) ?? 'Almacén origen'} <Icon source="arrow-right" size={12} /> {warehouseNames.get(transfer.to_warehouse_id) ?? 'Almacén destino'}</Text>
          <Text numberOfLines={1} style={styles.meta}>{transfer.items.length} {transfer.items.length === 1 ? 'variante' : 'variantes'} · {transfer.notes || 'Sin observación'}</Text>
        </View>
      );
    },
  }, {
    key: 'action',
    title: '',
    style: styles.actionColumn,
    renderCell: () => <Icon color="#60706E" size={22} source="chevron-right" />,
  }], [warehouseNames]);

  function openTransfer(transfer: InventoryTransfer) {
    router.push({ pathname: '/transfers/[transferId]', params: { transferId: String(transfer.id) } } as Href);
  }

  return (
    <View style={styles.screen}>
      <ListToolbar
        activeFilterIds={activeFilterIds}
        createLabel="Nuevo traslado"
        filterOptions={STATUS_FILTERS}
        onCreate={canManage ? () => router.push('/transfers/new') : undefined}
        onPageChange={setPage}
        onQueryChange={(value) => { setQuery(value); setPage(1); }}
        onToggleFilter={(id) => { setActiveFilterIds((current) => current.includes(id) ? current.filter((currentId) => currentId !== id) : [...current, id]); setPage(1); }}
        page={currentPage}
        pageSize={PAGE_SIZE}
        query={query}
        title="Traslados"
        totalItems={filteredTransfers.length}
      />
      <DataTable
        columns={columns}
        data={visibleTransfers}
        emptyIcon="truck-fast-outline"
        emptyText={query.trim() || activeFilterIds.length > 0 ? 'Cambia la búsqueda o los filtros.' : 'Usa “Nuevo traslado” para enviar stock al almacén medio.'}
        emptyTitle={query.trim() || activeFilterIds.length > 0 ? 'Sin resultados' : 'Aún no hay traslados'}
        error={error}
        keyExtractor={(transfer) => String(transfer.id)}
        loading={loading}
        onRefresh={() => void load(true)}
        onRetry={() => void load()}
        onRowPress={openTransfer}
        refreshing={refreshing}
        rowAccessibilityLabel={(transfer) => `Abrir traslado ${transfer.id}`}
        showHeader={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' },
  detailColumn: { flex: 1 },
  actionColumn: { width: 42, alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flexShrink: 1, color: '#172423', fontSize: 14, fontWeight: '800' },
  status: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, fontSize: 9, fontWeight: '800' },
  route: { marginTop: 5, color: '#172423', fontSize: 11, fontWeight: '700' },
  meta: { marginTop: 4, color: '#60706E', fontSize: 10 },
});