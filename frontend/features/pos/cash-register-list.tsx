import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';
import { DataTable, type DataTableColumn } from '../../components/data/data-table';
import { ListToolbar } from '../../components/data/list-toolbar';
import { api, apiErrorMessage } from '../../lib/api';
import type { CashRegister, CashRegisterSession } from './pos-types';

const PAGE_SIZE = 20;
const STATUS_FILTERS = [
  { id: 'active', label: 'Activas', group: 'Estado' },
  { id: 'inactive', label: 'Inactivas', group: 'Estado' },
];

export function CashRegisterList() {
  const [items, setItems] = useState<CashRegister[]>([]);
  const [openSessions, setOpenSessions] = useState<CashRegisterSession[]>([]);
  const [query, setQuery] = useState('');
  const [activeFilterIds, setActiveFilterIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadItems = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const [registerResponse, sessionResponse] = await Promise.all([
        api.get('/cash-registers'),
        api.get('/cash-register-sessions', { params: { status: 'open' } }),
      ]);
      setItems(registerResponse.data.data ?? []);
      setOpenSessions(sessionResponse.data.data ?? []);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'No se pudieron cargar las cajas.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadItems();
  }, [loadItems]));

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es');
    const selectedStates = activeFilterIds.filter((id) => id === 'active' || id === 'inactive');

    return items.filter((item) => {
      const searchable = `${item.code} ${item.name} ${item.store?.name ?? ''} ${item.warehouse?.name ?? ''}`
        .toLocaleLowerCase('es');
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesState = selectedStates.length === 0
        || (item.is_active ? selectedStates.includes('active') : selectedStates.includes('inactive'));
      return matchesQuery && matchesState;
    });
  }, [activeFilterIds, items, query]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleItems = useMemo(
    () => filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, filteredItems],
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const openSessionByRegisterId = useMemo(
    () => new Map(openSessions.map((session) => [session.cash_register_id, session])),
    [openSessions],
  );

  const columns = useMemo<DataTableColumn<CashRegister>[]>(() => [
    {
      key: 'detail',
      title: 'Caja',
      style: styles.detailColumn,
      renderCell: (item) => (
        <View>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
            {!item.is_active ? <Text style={styles.inactive}>Inactiva</Text> : null}
          </View>
          <Text numberOfLines={2} style={styles.meta}>
            {item.code} · {item.store?.name} · Retira de {item.warehouse?.name}
          </Text>
          <Text numberOfLines={1} style={styles.series}>
            {item.sales_series?.map((series) => series.id === item.default_sales_series_id ? `${series.series_code} (principal)` : series.series_code).join(' · ') || 'Sin series'}
          </Text>
        </View>
      ),
    },
    {
      key: 'actions',
      title: '',
      style: styles.actionsColumn,
      renderCell: (item) => {
        const openSession = openSessionByRegisterId.get(item.id);
        return (
          <View style={styles.actions}>
            <Button
              buttonColor={openSession ? '#E3F4EE' : '#FF4D4D'}
              contentStyle={styles.openButtonContent}
              disabled={!item.is_active && !openSession}
              labelStyle={[styles.openButtonLabel, openSession && styles.activeSessionLabel]}
              mode="contained"
              onPress={() => openCashRegister(item, openSession)}
              style={styles.openButton}
              textColor={openSession ? '#226D5C' : '#FFFFFF'}
            >
              {openSession ? 'Continuar' : 'Abrir'}
            </Button>
            <IconButton
              accessibilityLabel={`Configurar ${item.name}`}
              icon="cog-outline"
              iconColor="#60706E"
              mode="contained-tonal"
              onPress={() => openEdit(item)}
              size={19}
              style={styles.settingsButton}
            />
          </View>
        );
      },
    },
  ], [openSessionByRegisterId]);

  function toggleFilter(filterId: string) {
    setActiveFilterIds((current) => current.includes(filterId)
      ? current.filter((id) => id !== filterId)
      : [...current, filterId]);
    setPage(1);
  }

  function openEdit(item: CashRegister) {
    router.push({
      pathname: '/pos/cash-registers/[cashRegisterId]',
      params: { cashRegisterId: String(item.id) },
    } as Href);
  }

  function openCashRegister(item: CashRegister, openSession?: CashRegisterSession) {
    if (openSession) {
      router.push({
        pathname: '/pos/terminal/[cashSessionId]',
        params: { cashSessionId: String(openSession.id) },
      } as Href);
      return;
    }

    router.push({
      pathname: '/pos/cash-sessions/open',
      params: { cashRegisterId: String(item.id) },
    } as Href);
  }

  return (
    <View style={styles.screen}>
      <ListToolbar
        activeFilterIds={activeFilterIds}
        filterOptions={STATUS_FILTERS}
        onCreate={() => router.push('/pos/cash-registers/new')}
        onPageChange={setPage}
        onQueryChange={(value) => { setQuery(value); setPage(1); }}
        onToggleFilter={toggleFilter}
        page={currentPage}
        pageSize={PAGE_SIZE}
        query={query}
        title="Cajas"
        totalItems={filteredItems.length}
      />
      <DataTable
        columns={columns}
        data={visibleItems}
        emptyIcon="cash-register"
        emptyText={query.trim() || activeFilterIds.length > 0 ? 'Prueba con otro texto o cambia los filtros.' : 'Crea una caja y define de qué almacén retirará.'}
        emptyTitle={query.trim() || activeFilterIds.length > 0 ? 'Sin resultados' : 'Aún no hay cajas'}
        error={error}
        keyExtractor={(item) => String(item.id)}
        loading={loading}
        onRefresh={() => void loadItems(true)}
        onRetry={() => void loadItems()}
        refreshing={refreshing}
        rowStyle={styles.row}
        showHeader={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' },
  row: { minHeight: 88, paddingHorizontal: 16, paddingVertical: 10 },
  detailColumn: { flex: 1 },
  actionsColumn: { width: 158, alignItems: 'flex-end' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  openButton: { minWidth: 96, borderRadius: 9 },
  openButtonContent: { minHeight: 40, paddingHorizontal: 12 },
  openButtonLabel: { marginHorizontal: 0, marginVertical: 0, fontSize: 11, fontWeight: '900' },
  activeSessionLabel: { color: '#226D5C' },
  settingsButton: { width: 40, height: 40, margin: 0, borderRadius: 9, backgroundColor: '#EAEFEE' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, color: '#172423', fontSize: 14, fontWeight: '800' },
  inactive: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7, color: '#60706E', backgroundColor: '#EAEFEE', fontSize: 9, fontWeight: '800' },
  meta: { marginTop: 4, color: '#736D77', fontSize: 11, lineHeight: 15 },
  series: { marginTop: 4, color: '#B4232D', fontSize: 10, fontWeight: '700' },
});
