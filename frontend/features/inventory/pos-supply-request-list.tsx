import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';
import { MobileRecordList } from '../../components/data/mobile-record-list';
import { api, apiErrorMessage } from '../../lib/api';
import { formatBaseQuantity } from '../pos/pos-measurement';
import type { InventoryTransfer, InventoryTransferItem } from './inventory-types';

const POLL_INTERVAL_MS = 4000;

function formatItemQuantity(item: InventoryTransferItem) {
  return formatBaseQuantity(Number(item.quantity) || 0, item.product?.base_unit ?? null);
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Cola del almacén de medio: comandas (traslados con pos_order_id) que las
 * cajas del POS generaron por falta de stock. Hace polling mientras la
 * pantalla está enfocada, como un display de cocina.
 */
export function PosSupplyRequestList() {
  const [items, setItems] = useState<InventoryTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const loadItems = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const response = await api.get('/warehouse/supply-requests', { params: { status: 'draft' } });
      setItems((response.data.data ?? []) as InventoryTransfer[]);
      setError('');
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'No se pudieron cargar las comandas.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadItems();
    const interval = setInterval(() => { void loadItems(); }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadItems]));

  async function resolve(transfer: InventoryTransfer) {
    setResolvingId(transfer.id);
    setNotice('');
    try {
      await api.post(`/warehouse/supply-requests/${transfer.id}/resolve`);
      setItems((current) => current.filter((item) => item.id !== transfer.id));
      setNotice(`Comanda de la orden #${transfer.pos_order_number ?? transfer.pos_order_id} lista, stock repuesto.`);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'No se pudo marcar la comanda como lista.'));
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <View style={styles.screen}>
      {notice ? (
        <View style={styles.notice}>
          <Icon color="#247451" size={18} source="check-circle-outline" />
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}
      <MobileRecordList
        data={items}
        emptyIcon="clipboard-check-outline"
        emptyText="Las órdenes del POS que necesiten stock del almacén principal aparecerán aquí."
        emptyTitle="No hay comandas pendientes"
        error={error}
        keyExtractor={(item) => String(item.id)}
        loading={loading}
        onRefresh={() => void loadItems(true)}
        onRetry={() => void loadItems()}
        refreshing={refreshing}
        renderItem={(transfer) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon color="#B4232D" size={20} source="receipt-text-outline" />
              <Text style={styles.cardTitle}>Orden #{transfer.pos_order_number ?? transfer.pos_order_id}</Text>
              <Text style={styles.cardTime}>{formatTime(transfer.created_at)}</Text>
            </View>
            <View style={styles.itemList}>
              {transfer.items.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <Text style={styles.itemQuantity}>{formatItemQuantity(item)}</Text>
                  <Text numberOfLines={1} style={styles.itemName}>
                    {item.product?.name ?? `Producto #${item.product_id}`}
                  </Text>
                </View>
              ))}
            </View>
            <Button
              buttonColor="#247451"
              disabled={resolvingId !== null}
              icon="check-bold"
              loading={resolvingId === transfer.id}
              mode="contained"
              onPress={() => void resolve(transfer)}
              style={styles.button}
              textColor="#FFFFFF"
            >
              Marcar listo
            </Button>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' },
  notice: { margin: 12, marginBottom: 0, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#247451', borderRadius: 9, backgroundColor: '#E0F3EA' },
  noticeText: { flex: 1, color: '#247451', fontSize: 11, fontWeight: '700' },
  card: { margin: 12, marginBottom: 0, padding: 12, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 12, backgroundColor: '#FFFFFF' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, color: '#172423', fontSize: 14, fontWeight: '900' },
  cardTime: { color: '#60706E', fontSize: 10, fontWeight: '700' },
  itemList: { marginTop: 10, gap: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemQuantity: { minWidth: 64, color: '#B4232D', fontSize: 12, fontWeight: '900' },
  itemName: { flex: 1, color: '#172423', fontSize: 12, fontWeight: '600' },
  button: { marginTop: 12 },
});
