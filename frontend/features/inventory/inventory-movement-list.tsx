import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { DataTable, type DataTableColumn } from '../../components/data/data-table';
import { ListToolbar } from '../../components/data/list-toolbar';
import { api, apiErrorMessage } from '../../lib/api';
import type { InventoryMovement, InventoryMovementFlow } from './inventory-types';

type InventoryMovementListProps = {
  initialFlow?: InventoryMovementFlow;
  productId?: string;
  showBack?: boolean;
};

const PAGE_SIZE = 20;
const TYPE_LABELS = {
  purchase: 'Compra',
  transfer_in: 'Transferencia recibida',
  transfer_out: 'Transferencia enviada',
  sale: 'Venta',
  adjustment: 'Ajuste',
} as const;

const TYPE_FILTERS = Object.entries(TYPE_LABELS).map(([type, label]) => ({ id: `type:${type}`, label, group: 'Tipo' }));

export function InventoryMovementList({ initialFlow = 'all', productId, showBack = false }: InventoryMovementListProps) {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [flow, setFlow] = useState<InventoryMovementFlow>(initialFlow);
  const [query, setQuery] = useState('');
  const [activeFilterIds, setActiveFilterIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadMovements = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const response = await api.get('/inventory-movements', {
        params: { ...(productId ? { product_id: productId } : {}) },
      });
      setMovements(response.data.data ?? []);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'No se pudieron cargar los movimientos de inventario.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [productId]);

  useFocusEffect(useCallback(() => {
    void loadMovements();
  }, [loadMovements]));

  useEffect(() => {
    setFlow(initialFlow);
    setPage(1);
  }, [initialFlow]);

  const warehouseFilters = useMemo(() => {
    const warehouses = new Map(movements.map((movement) => [movement.warehouse_id, movement.warehouse.name]));
    return [...warehouses.entries()].map(([id, name]) => ({ id: `warehouse:${id}`, label: name, group: 'Almacén' }));
  }, [movements]);
  const filterOptions = useMemo(() => [...TYPE_FILTERS, ...warehouseFilters], [warehouseFilters]);
  const filteredMovements = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es');
    const types = activeFilterIds.filter((id) => id.startsWith('type:')).map((id) => id.replace('type:', ''));
    const warehouseIds = activeFilterIds.filter((id) => id.startsWith('warehouse:')).map((id) => Number(id.replace('warehouse:', '')));

    return movements.filter((movement) => {
      const searchText = `${movement.product.name} ${movement.product.sku} ${movement.warehouse.name} ${movement.notes ?? ''} ${movement.reference_id ?? ''}`;
      return (flow === 'all' || movement.flow === flow)
        && (types.length === 0 || types.includes(movement.type))
        && (warehouseIds.length === 0 || warehouseIds.includes(movement.warehouse_id))
        && (!normalized || searchText.toLocaleLowerCase('es').includes(normalized));
    });
  }, [activeFilterIds, flow, movements, query]);

  const totalPages = Math.max(1, Math.ceil(filteredMovements.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleMovements = filteredMovements.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const columns = useMemo<DataTableColumn<InventoryMovement>[]>(() => [
    {
      key: 'detail',
      title: 'Movimiento',
      style: styles.detailColumn,
      renderCell: (movement) => (
        <View>
          <View style={styles.titleRow}>
            <Text numberOfLines={1} style={styles.product}>{movement.product.name}</Text>
            <Text style={[styles.flowBadge, movement.flow === 'in' ? styles.flowIn : styles.flowOut]}>
              {movement.flow === 'in' ? 'Entrada' : 'Salida'}
            </Text>
          </View>
          <Text style={styles.meta}>{TYPE_LABELS[movement.type]} · {movement.warehouse.name} · {new Date(movement.created_at).toLocaleString('es-PE')}</Text>
          {movement.notes ? <Text numberOfLines={1} style={styles.notes}>{movement.notes}</Text> : null}
        </View>
      ),
    },
    {
      key: 'quantity',
      title: 'Cantidad',
      style: styles.quantityColumn,
      headerAlign: 'right',
      renderCell: (movement) => (
        <View style={styles.numberCell}>
          <Text style={[styles.quantity, movement.flow === 'in' ? styles.quantityIn : styles.quantityOut]}>
            {movement.flow === 'in' ? '+' : '-'}{Number(movement.quantity).toFixed(2)}
          </Text>
          <Text style={styles.balance}>Saldo {Number(movement.balance_quantity).toFixed(2)}</Text>
        </View>
      ),
    },
  ], []);

  function changeFlow(nextFlow: InventoryMovementFlow) {
    setFlow(nextFlow);
    setPage(1);
  }

  function toggleFilter(filterId: string) {
    setActiveFilterIds((current) => current.includes(filterId) ? current.filter((id) => id !== filterId) : [...current, filterId]);
    setPage(1);
  }

  const filtered = Boolean(query.trim()) || activeFilterIds.length > 0 || flow !== 'all';
  const productName = productId ? movements[0]?.product.name : null;

  return (
    <View style={styles.screen}>
      {showBack ? <Button icon="arrow-left" mode="text" onPress={() => router.back()} style={styles.backButton}>Volver al producto</Button> : null}
      <View style={styles.flowActions}>
        <Button mode={flow === 'all' ? 'contained' : 'outlined'} onPress={() => changeFlow('all')}>Movimientos</Button>
        <Button mode={flow === 'in' ? 'contained' : 'outlined'} onPress={() => changeFlow('in')}>Entradas</Button>
        <Button mode={flow === 'out' ? 'contained' : 'outlined'} onPress={() => changeFlow('out')}>Salidas</Button>
      </View>
      <ListToolbar
        activeFilterIds={activeFilterIds}
        filterOptions={filterOptions}
        onPageChange={setPage}
        onQueryChange={(value) => { setQuery(value); setPage(1); }}
        onToggleFilter={toggleFilter}
        page={currentPage}
        pageSize={PAGE_SIZE}
        query={query}
        title={productName ? `Kardex · ${productName}` : 'Kardex'}
        totalItems={filteredMovements.length}
      />
      <DataTable
        columns={columns}
        data={visibleMovements}
        emptyIcon="swap-vertical"
        emptyText={filtered ? 'Cambia los filtros para consultar otros movimientos.' : 'Los movimientos aparecerán al confirmar compras, registrar ventas, transferencias o ajustes.'}
        emptyTitle={filtered ? 'Sin movimientos para este filtro' : 'Aún no hay movimientos'}
        error={error}
        keyExtractor={(movement) => String(movement.id)}
        loading={loading}
        onRefresh={() => void loadMovements(true)}
        onRetry={() => void loadMovements()}
        refreshing={refreshing}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' },
  backButton: { alignSelf: 'flex-start', marginTop: 8, marginLeft: 8 },
  flowActions: { padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8, backgroundColor: '#FFFFFF' },
  detailColumn: { flex: 1 },
  quantityColumn: { width: 120, alignItems: 'flex-end' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  product: { flexShrink: 1, color: '#172423', fontSize: 13, fontWeight: '800' },
  flowBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, fontSize: 9, fontWeight: '800' },
  flowIn: { color: '#26705D', backgroundColor: '#E3F4EE' },
  flowOut: { color: '#8F1D2C', backgroundColor: '#FCE8EA' },
  meta: { marginTop: 4, color: '#60706E', fontSize: 10, lineHeight: 15 },
  notes: { marginTop: 3, color: '#60706E', fontSize: 10, fontStyle: 'italic' },
  numberCell: { alignItems: 'flex-end' },
  quantity: { fontSize: 13, fontWeight: '900' },
  quantityIn: { color: '#26705D' },
  quantityOut: { color: '#8F1D2C' },
  balance: { marginTop: 4, color: '#60706E', fontSize: 9 },
});
