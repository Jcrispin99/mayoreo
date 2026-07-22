import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Snackbar, Text } from 'react-native-paper';
import { DataTable, type DataTableColumn } from '../../components/data/data-table';
import { ListToolbar } from '../../components/data/list-toolbar';
import { api } from '../../lib/api';
import type { InventoryItem, InventoryResourceKind, Store, UnitOfMeasure, Warehouse } from './inventory-types';

type InventoryReferenceListProps = {
  kind: InventoryResourceKind;
};

const CONFIG = {
  stores: { endpoint: '/stores', title: 'Tiendas', icon: 'storefront-outline' },
  warehouses: { endpoint: '/warehouses', title: 'Almacenes', icon: 'warehouse' },
  units: { endpoint: '/units-of-measure', title: 'Unidades de medida', icon: 'scale-balance' },
} as const;

const UNIT_TYPES = { weight: 'Peso', volume: 'Volumen', count: 'Conteo' } as const;
const PAGE_SIZE = 20;
const STATUS_FILTERS = [
  { id: 'active', label: 'Activos', group: 'Estado' },
  { id: 'inactive', label: 'Inactivos', group: 'Estado' },
];

function itemMeta(kind: InventoryResourceKind, item: InventoryItem) {
  if (kind === 'stores') {
    const store = item as Store;
    const defaultWarehouse = store.warehouses.find((warehouse) => warehouse.is_default);
    const count = store.warehouses.length;
    return `${defaultWarehouse?.name ?? 'Sin almacén predeterminado'} · ${count} ${count === 1 ? 'almacén' : 'almacenes'}`;
  }

  if (kind === 'warehouses') {
    const warehouse = item as Warehouse;
    return `${warehouse.store?.name ?? 'Sin tienda'}${warehouse.is_default ? ' · Predeterminado' : ''}`;
  }

  return UNIT_TYPES[(item as UnitOfMeasure).type];
}

export function InventoryReferenceList({ kind }: InventoryReferenceListProps) {
  const config = CONFIG[kind];
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [activeFilterIds, setActiveFilterIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadItems = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');

    try {
      const [itemsResponse, storesResponse] = await Promise.all([
        api.get(config.endpoint),
        kind === 'warehouses' ? api.get('/stores') : Promise.resolve(null),
      ]);
      setItems(itemsResponse.data.data ?? []);
      if (storesResponse) setStores(storesResponse.data.data ?? []);
    } catch {
      setError(`No se pudieron cargar ${config.title.toLocaleLowerCase('es')}.`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [config.endpoint, config.title, kind]);

  useFocusEffect(useCallback(() => {
    void loadItems();
  }, [loadItems]));

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es');
    const selectedStates = activeFilterIds.filter((filterId) => filterId === 'active' || filterId === 'inactive');

    return items.filter((item) => {
      const matchesQuery = !normalizedQuery
        || `${item.code} ${item.name} ${itemMeta(kind, item)}`.toLocaleLowerCase('es').includes(normalizedQuery);
      const matchesState = !('is_active' in item) || selectedStates.length === 0
        || (item.is_active ? selectedStates.includes('active') : selectedStates.includes('inactive'));
      return matchesQuery && matchesState;
    });
  }, [activeFilterIds, items, kind, query]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleItems = useMemo(
    () => filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, filteredItems],
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setQuery('');
    setActiveFilterIds([]);
    setPage(1);
  }, [kind]);

  const columns = useMemo<DataTableColumn<InventoryItem>[]>(() => [
    {
      key: 'detail',
      title: 'Detalle',
      style: styles.detailColumn,
      renderCell: (item) => (
        <View>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
            {'is_active' in item && !item.is_active ? <Text style={styles.inactive}>Inactivo</Text> : null}
          </View>
          <Text numberOfLines={2} style={styles.meta}>{item.code} · {itemMeta(kind, item)}</Text>
        </View>
      ),
    },
    {
      key: 'action',
      title: '',
      style: styles.actionColumn,
      renderCell: () => <Icon source="chevron-right" color="#A49DA7" size={22} />,
    },
  ], [kind]);

  function openCreate() {
    if (kind === 'warehouses' && stores.length === 0) {
      setMessage('Primero crea una tienda.');
      return;
    }
    router.push({ pathname: '/inventory/[resource]/new', params: { resource: kind } } as Href);
  }

  function openEdit(item: InventoryItem) {
    router.push({
      pathname: '/inventory/[resource]/[itemId]',
      params: { resource: kind, itemId: String(item.id) },
    } as Href);
  }

  function changeQuery(nextQuery: string) {
    setQuery(nextQuery);
    setPage(1);
  }

  function toggleFilter(filterId: string) {
    setActiveFilterIds((current) => current.includes(filterId)
      ? current.filter((currentId) => currentId !== filterId)
      : [...current, filterId]);
    setPage(1);
  }

  return (
    <View style={styles.screen}>
      <ListToolbar
        activeFilterIds={activeFilterIds}
        filterOptions={kind === 'units' ? [] : STATUS_FILTERS}
        onCreate={openCreate}
        onPageChange={setPage}
        onQueryChange={changeQuery}
        onToggleFilter={toggleFilter}
        page={currentPage}
        pageSize={PAGE_SIZE}
        query={query}
        title={config.title}
        totalItems={filteredItems.length}
      />
      <DataTable
        columns={columns}
        data={visibleItems}
        emptyIcon={config.icon}
        emptyText={query.trim() || activeFilterIds.length > 0 ? 'Prueba con otro texto o cambia los filtros.' : 'Usa “Nuevo” para crear el primer registro.'}
        emptyTitle={query.trim() || activeFilterIds.length > 0 ? 'Sin resultados' : `Aún no hay ${config.title.toLocaleLowerCase('es')}`}
        error={error}
        keyExtractor={(item) => String(item.id)}
        loading={loading}
        onRefresh={() => void loadItems(true)}
        onRetry={() => void loadItems()}
        onRowPress={openEdit}
        refreshing={refreshing}
        rowAccessibilityLabel={(item) => `Editar ${item.name}`}
        rowStyle={styles.compactRow}
        showHeader={false}
      />

      <Snackbar duration={2400} onDismiss={() => setMessage('')} visible={Boolean(message)}>{message}</Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F5F8' },
  compactRow: { minHeight: 68, paddingHorizontal: 16, paddingVertical: 9 },
  detailColumn: { flex: 1 },
  actionColumn: { width: 42, alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, color: '#302A33', fontSize: 14, fontWeight: '800' },
  meta: { marginTop: 4, color: '#827B85', fontSize: 11, lineHeight: 15 },
  inactive: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7, color: '#925064', backgroundColor: '#F8E8ED', fontSize: 9, fontWeight: '800' },
});
