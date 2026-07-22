import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { DataTable, type DataTableColumn } from '../../components/data/data-table';
import { ListToolbar } from '../../components/data/list-toolbar';
import { api } from '../../lib/api';
import type { PurchaseOrder, Supplier, Warehouse } from './purchase-types';

const PAGE_SIZE = 20;
const STATUS = {
  draft: { label: 'Borrador', color: '#73547B', backgroundColor: '#F0EAF2' },
  confirmed: { label: 'Confirmada', color: '#26705D', backgroundColor: '#E3F4EE' },
  cancelled: { label: 'Cancelada', color: '#925064', backgroundColor: '#F8E8ED' },
} as const;

const STATUS_FILTERS = [
  { id: 'status:draft', label: 'Borrador', group: 'Estado' },
  { id: 'status:confirmed', label: 'Confirmadas', group: 'Estado' },
  { id: 'status:cancelled', label: 'Canceladas', group: 'Estado' },
];

export function PurchaseOrderList() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [query, setQuery] = useState('');
  const [activeFilterIds, setActiveFilterIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadOrders = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');

    try {
      const [ordersResponse, suppliersResponse, warehousesResponse] = await Promise.all([
        api.get('/purchase-orders'),
        api.get('/suppliers'),
        api.get('/warehouses'),
      ]);
      setOrders(ordersResponse.data.data ?? []);
      setSuppliers(suppliersResponse.data.data ?? []);
      setWarehouses(warehousesResponse.data.data ?? []);
    } catch {
      setError('No se pudieron cargar las compras.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadOrders();
  }, [loadOrders]));

  const supplierNames = useMemo(() => new Map(suppliers.map((item) => [item.id, item.name])), [suppliers]);
  const warehouseNames = useMemo(() => new Map(warehouses.map((item) => [item.id, item.name])), [warehouses]);
  const filterOptions = useMemo(() => [
    ...STATUS_FILTERS,
    ...warehouses.map((warehouse) => ({
      id: `warehouse:${warehouse.id}`,
      label: warehouse.name,
      group: 'Almacén',
    })),
  ], [warehouses]);
  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es');
    const selectedStatuses = activeFilterIds
      .filter((id) => id.startsWith('status:'))
      .map((id) => id.replace('status:', ''));
    const selectedWarehouseIds = activeFilterIds
      .filter((id) => id.startsWith('warehouse:'))
      .map((id) => Number(id.replace('warehouse:', '')));

    return orders.filter((order) => {
      const searchText = `${order.full_number ?? ''} ${order.invoice_full_number ?? ''} ${supplierNames.get(order.supplier_id) ?? ''} ${warehouseNames.get(order.warehouse_id) ?? ''}`;
      const matchesQuery = !normalized || searchText.toLocaleLowerCase('es').includes(normalized);
      const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(order.status);
      const matchesWarehouse = selectedWarehouseIds.length === 0 || selectedWarehouseIds.includes(order.warehouse_id);
      return matchesQuery && matchesStatus && matchesWarehouse;
    });
  }, [activeFilterIds, orders, query, supplierNames, warehouseNames]);
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleOrders = filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const columns = useMemo<DataTableColumn<PurchaseOrder>[]>(() => [
    {
      key: 'detail',
      title: 'Detalle',
      style: styles.detailColumn,
      renderCell: (order) => (
        <View>
          <View style={styles.titleRow}>
            <Text numberOfLines={1} style={styles.name}>{supplierNames.get(order.supplier_id) ?? `Proveedor #${order.supplier_id}`}</Text>
            <Text style={[styles.status, { color: STATUS[order.status].color, backgroundColor: STATUS[order.status].backgroundColor }]}>
              {STATUS[order.status].label}
            </Text>
          </View>
          <Text numberOfLines={2} style={styles.meta}>
            {order.full_number ?? `Compra #${order.id}`} · {order.invoice_full_number ? `Factura ${order.invoice_full_number}` : 'Sin factura'} · {order.ordered_at} · {warehouseNames.get(order.warehouse_id) ?? `Almacén #${order.warehouse_id}`}
          </Text>
        </View>
      ),
    },
    {
      key: 'items',
      title: '',
      style: styles.itemsColumn,
      renderCell: (order) => (
        <View style={styles.amountCell}>
          <Text style={styles.amount}>S/ {Number(order.total).toFixed(2)}</Text>
          <Text style={styles.itemCount}>{order.items.length} {order.items.length === 1 ? 'ítem' : 'ítems'}</Text>
        </View>
      ),
    },
  ], [supplierNames, warehouseNames]);

  function changeQuery(nextQuery: string) {
    setQuery(nextQuery);
    setPage(1);
  }

  function toggleFilter(filterId: string) {
    setActiveFilterIds((current) => current.includes(filterId)
      ? current.filter((id) => id !== filterId)
      : [...current, filterId]);
    setPage(1);
  }

  const filtered = Boolean(query.trim()) || activeFilterIds.length > 0;

  function openOrder(order: PurchaseOrder) {
    router.push({
      pathname: '/purchases/[purchaseId]',
      params: { purchaseId: String(order.id) },
    } as Href);
  }

  return (
    <View style={styles.screen}>
      <ListToolbar
        activeFilterIds={activeFilterIds}
        filterOptions={filterOptions}
        onCreate={() => router.push('/purchases/new')}
        onPageChange={setPage}
        onQueryChange={changeQuery}
        onToggleFilter={toggleFilter}
        page={currentPage}
        pageSize={PAGE_SIZE}
        query={query}
        title="Compras"
        totalItems={filteredOrders.length}
      />
      <DataTable
        columns={columns}
        data={visibleOrders}
        emptyIcon="cart-plus"
        emptyText={filtered ? 'Prueba con otro proveedor, número de factura o cambia los filtros.' : 'Usa “Nuevo” para registrar la primera compra.'}
        emptyTitle={filtered ? 'Sin resultados' : 'Aún no hay compras'}
        error={error}
        keyExtractor={(order) => String(order.id)}
        loading={loading}
        onRefresh={() => void loadOrders(true)}
        onRetry={() => void loadOrders()}
        onRowPress={openOrder}
        refreshing={refreshing}
        rowAccessibilityLabel={(order) => `Abrir ${order.full_number ?? `compra ${order.id}`}`}
        showHeader={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F5F8' },
  detailColumn: { flex: 1 },
  itemsColumn: { width: 105, alignItems: 'flex-end' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, color: '#302A33', fontSize: 14, fontWeight: '800' },
  status: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, color: '#73547B', backgroundColor: '#F0EAF2', fontSize: 9, fontWeight: '800' },
  meta: { marginTop: 4, color: '#827B85', fontSize: 11, lineHeight: 15 },
  amountCell: { alignItems: 'flex-end', gap: 3 },
  amount: { color: '#403743', fontSize: 12, fontWeight: '800' },
  itemCount: { color: '#756E78', fontSize: 10, fontWeight: '700' },
});
