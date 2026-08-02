import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { DataTable, type DataTableColumn } from '../../components/data/data-table';
import { ListToolbar } from '../../components/data/list-toolbar';
import { api, apiErrorMessage } from '../../lib/api';
import type { PosPaymentMethod, PosPaymentMethodDefinition } from './pos-types';

const PAYMENT_METHOD_ICONS: Record<PosPaymentMethod, string> = {
  cash: 'cash',
  card: 'credit-card-outline',
  yape: 'cellphone-check',
  plin: 'cellphone-arrow-down',
  bank_transfer: 'bank-transfer',
};

export function PosPaymentMethodList() {
  const [methods, setMethods] = useState<PosPaymentMethodDefinition[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadMethods = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');

    try {
      const response = await api.get('/pos/payment-methods');
      setMethods(response.data.data ?? []);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'No se pudieron cargar los métodos de pago.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadMethods();
  }, [loadMethods]));

  const filteredMethods = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es');
    if (!normalized) return methods;

    return methods.filter((method) => (
      `${method.label} ${method.code} ${method.description}`
        .toLocaleLowerCase('es')
        .includes(normalized)
    ));
  }, [methods, query]);

  const columns = useMemo<DataTableColumn<PosPaymentMethodDefinition>[]>(() => [
    {
      key: 'icon',
      title: '',
      style: styles.iconColumn,
      renderCell: (method) => (
        <View style={styles.iconBox}>
          <Icon color="#B4232D" size={25} source={PAYMENT_METHOD_ICONS[method.code]} />
        </View>
      ),
    },
    {
      key: 'detail',
      title: 'Método',
      style: styles.detailColumn,
      renderCell: (method) => (
        <View>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{method.label}</Text>
            <Text style={styles.code}>{method.code}</Text>
          </View>
          <Text style={styles.description}>{method.description}</Text>
          <Text style={styles.behavior}>
            {method.requires_received_amount
              ? 'Solicita efectivo recibido y calcula vuelto'
              : 'Importe fijo del total cobrado'}
            {method.supports_reference ? ' · Referencia opcional' : ''}
          </Text>
        </View>
      ),
    },
  ], []);

  return (
    <View style={styles.screen}>
      <ListToolbar
        activeFilterIds={[]}
        filterOptions={[]}
        onPageChange={() => undefined}
        onQueryChange={setQuery}
        onToggleFilter={() => undefined}
        page={1}
        pageSize={Math.max(1, filteredMethods.length)}
        query={query}
        title="Métodos de pago"
        totalItems={filteredMethods.length}
      />
      <DataTable
        columns={columns}
        data={filteredMethods}
        emptyIcon="credit-card-outline"
        emptyText="El catálogo POS no devolvió métodos disponibles."
        emptyTitle="Sin métodos de pago"
        error={error}
        keyExtractor={(method) => method.code}
        loading={loading}
        onRefresh={() => void loadMethods(true)}
        onRetry={() => void loadMethods()}
        refreshing={refreshing}
        rowStyle={styles.row}
        showHeader={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' },
  row: { minHeight: 94, paddingHorizontal: 16, paddingVertical: 12 },
  iconColumn: { width: 54 },
  detailColumn: { flex: 1 },
  iconBox: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#FFE5E5' },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  name: { color: '#172423', fontSize: 14, fontWeight: '900' },
  code: { color: '#B4232D', fontSize: 9, fontWeight: '800' },
  description: { marginTop: 4, color: '#60706E', fontSize: 10, lineHeight: 15 },
  behavior: { marginTop: 4, color: '#4E6F78', fontSize: 9, fontWeight: '700' },
});
