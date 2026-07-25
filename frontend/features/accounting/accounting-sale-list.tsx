import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { DataTable, type DataTableColumn } from '../../components/data/data-table';
import { ListToolbar } from '../../components/data/list-toolbar';
import { api } from '../../lib/api';
import type { AccountingSale } from './accounting-types';

const PAGE_SIZE = 20;
const SOURCE_LABELS = { pos: 'POS', wholesale: 'Mayorista' } as const;
const FILTERS = [
  { id: 'source:pos', label: 'POS', group: 'Origen' },
  { id: 'source:wholesale', label: 'Mayoristas', group: 'Origen' },
  { id: 'payment:cash', label: 'Efectivo', group: 'Pago' },
  { id: 'payment:card', label: 'Tarjeta', group: 'Pago' },
  { id: 'payment:yape', label: 'Yape', group: 'Pago' },
  { id: 'payment:plin', label: 'Plin', group: 'Pago' },
  { id: 'payment:bank_transfer', label: 'Transferencia', group: 'Pago' },
];

function money(value: string | number) {
  return `S/ ${Number(value).toFixed(2)}`;
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function AccountingSaleList() {
  const [sales, setSales] = useState<AccountingSale[]>([]);
  const [query, setQuery] = useState('');
  const [activeFilterIds, setActiveFilterIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadSales = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');

    try {
      const salesResponse = await api.get('/sales');
      setSales(salesResponse.data.data ?? []);
    } catch {
      setError('No se pudo cargar el registro contable de ventas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadSales();
  }, [loadSales]));

  const filteredSales = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es');
    const sources = activeFilterIds
      .filter((id) => id.startsWith('source:'))
      .map((id) => id.replace('source:', ''));
    const payments = activeFilterIds
      .filter((id) => id.startsWith('payment:'))
      .map((id) => id.replace('payment:', ''));

    return sales.filter((sale) => {
      const payment = sale.payments[0]?.method ?? 'unpaid';
      const document = sale.primary_document?.full_number ?? '';
      const searchText = [
        document,
        sale.customer_name,
        sale.customer_document,
        SOURCE_LABELS[sale.source],
      ].filter(Boolean).join(' ').toLocaleLowerCase('es');

      return (!normalized || searchText.includes(normalized))
        && (sources.length === 0 || sources.includes(sale.source))
        && (payments.length === 0 || payments.includes(payment));
    });
  }, [activeFilterIds, query, sales]);
  const totalPages = Math.max(1, Math.ceil(filteredSales.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleSales = filteredSales.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const columns = useMemo<DataTableColumn<AccountingSale>[]>(() => [
    {
      key: 'detail',
      title: 'Venta',
      style: styles.detailColumn,
      renderCell: (sale) => {
        return (
          <View>
            <View style={styles.titleRow}>
              <Text numberOfLines={1} style={styles.document}>
                {sale.primary_document?.full_number ?? `Venta #${sale.id}`}
              </Text>
              <Text style={[
                styles.source,
                sale.source === 'pos' ? styles.sourcePos : styles.sourceWholesale,
              ]}>
                {SOURCE_LABELS[sale.source]}
              </Text>
            </View>
            <Text numberOfLines={1} style={styles.customer}>
              {sale.customer_name || (sale.source === 'pos' ? 'Cliente de mostrador' : 'Sin cliente')}
            </Text>
            <Text numberOfLines={1} style={styles.meta}>
              {dateTime(sale.sold_at)}
            </Text>
          </View>
        );
      },
    },
    {
      key: 'amount',
      title: 'Total',
      style: styles.amountColumn,
      renderCell: (sale) => (
        <View style={styles.amountCell}>
          <Text style={styles.amount}>{money(sale.payable_total)}</Text>
          <Text style={styles.itemCount}>
            {sale.items.length} {sale.items.length === 1 ? 'ítem' : 'ítems'}
          </Text>
          <Icon color="#60706E" size={19} source="chevron-right" />
        </View>
      ),
    },
  ], []);

  const pageTotal = visibleSales.reduce(
    (total, sale) => total + Number(sale.payable_total),
    0,
  );

  function openSale(sale: AccountingSale) {
    router.push({
      pathname: '/accounting/sales/[saleId]',
      params: { saleId: String(sale.id) },
    } as Href);
  }

  function toggleFilter(filterId: string) {
    setActiveFilterIds((current) => current.includes(filterId)
      ? current.filter((id) => id !== filterId)
      : [...current, filterId]);
    setPage(1);
  }

  return (
    <View style={styles.screen}>
      <ListToolbar
        activeFilterIds={activeFilterIds}
        createLabel="Venta mayorista"
        filterOptions={FILTERS}
        onCreate={() => router.push('/accounting/sales/new')}
        onPageChange={setPage}
        onQueryChange={(value) => {
          setQuery(value);
          setPage(1);
        }}
        onToggleFilter={toggleFilter}
        page={currentPage}
        pageSize={PAGE_SIZE}
        query={query}
        title="Registro de ventas"
        totalItems={filteredSales.length}
      />
      <DataTable
        columns={columns}
        data={visibleSales}
        emptyIcon="receipt-text-outline"
        emptyText="Las ventas completadas desde POS y mayorista aparecerán juntas aquí."
        emptyTitle="Aún no hay ventas"
        error={error}
        footer={visibleSales.length > 0 ? (
          <View style={styles.pageTotal}>
            <Text style={styles.pageTotalLabel}>Total</Text>
            <Text style={styles.pageTotalValue}>{money(pageTotal)}</Text>
          </View>
        ) : undefined}
        keyExtractor={(sale) => String(sale.id)}
        loading={loading}
        onRefresh={() => void loadSales(true)}
        onRetry={() => void loadSales()}
        onRowPress={openSale}
        refreshing={refreshing}
        rowAccessibilityLabel={(sale) => `Abrir venta ${sale.primary_document?.full_number ?? sale.id}`}
        rowStyle={styles.row}
        showHeader={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' },
  row: { minHeight: 88, paddingHorizontal: 16 },
  detailColumn: { flex: 1 },
  amountColumn: { width: 120, alignItems: 'flex-end' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  document: { flexShrink: 1, color: '#172423', fontSize: 14, fontWeight: '900' },
  source: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, fontSize: 9, fontWeight: '900' },
  sourcePos: { color: '#B4232D', backgroundColor: '#FFE5E5' },
  sourceWholesale: { color: '#B4232D', backgroundColor: '#FFE5E5' },
  customer: { marginTop: 5, color: '#172423', fontSize: 11, fontWeight: '700' },
  meta: { marginTop: 3, color: '#60706E', fontSize: 10, lineHeight: 14 },
  amountCell: { alignItems: 'flex-end', gap: 3 },
  amount: { color: '#B4232D', fontSize: 13, fontWeight: '900' },
  itemCount: { color: '#60706E', fontSize: 9 },
  pageTotal: { minHeight: 56, paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderTopWidth: 1, borderTopColor: '#D7E0DE', backgroundColor: '#FFFFFF' },
  pageTotalLabel: { color: '#172423', fontSize: 12, fontWeight: '900' },
  pageTotalValue: { color: '#172423', fontSize: 16, fontWeight: '900' },
});
