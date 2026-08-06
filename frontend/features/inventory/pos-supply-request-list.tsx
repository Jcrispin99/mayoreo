import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Checkbox, Icon, Text } from 'react-native-paper';
import { MobileRecordList } from '../../components/data/mobile-record-list';
import { api, apiErrorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { formatBaseQuantity } from '../pos/pos-measurement';
import type { PosSupplyRequest, PosSupplyRequestItem } from './inventory-types';

const POLL_INTERVAL_MS = 4000;

const CHANGE_LABELS: Record<PosSupplyRequestItem['change_type'], string> = {
  initial: 'Original',
  added: 'Agregado',
  increased: 'Aumentó',
  decreased: 'Disminuyó',
  removed: 'Retirado',
  note_changed: 'Cambió indicación',
};

function formatQuantity(item: PosSupplyRequestItem, value: string) {
  return formatBaseQuantity(Number(value) || 0, item.product?.base_unit ?? null);
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function quantitiesMatch(item: PosSupplyRequestItem) {
  return Math.abs(Number(item.prepared_quantity) - Number(item.requested_quantity)) < 0.000001;
}

function requestComplete(request: PosSupplyRequest) {
  return request.items.some((item) => Number(item.requested_quantity) > 0)
    && request.items.every(quantitiesMatch);
}

function statusLabel(request: PosSupplyRequest) {
  if (request.status === 'ready') return 'Listo · esperando recepción del POS';
  if (request.has_unreviewed_changes) return `Cambios nuevos · versión ${request.version}`;
  return 'En preparación';
}

export function PosSupplyRequestList() {
  const { user } = useAuth();
  const [items, setItems] = useState<PosSupplyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyKey, setBusyKey] = useState('');

  const loadItems = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const response = await api.get('/warehouse/supply-requests');
      setItems((response.data.data ?? []) as PosSupplyRequest[]);
      setError('');
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'No se pudieron cargar los pedidos asignados.'));
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

  function replaceRequest(updated: PosSupplyRequest) {
    setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
  }

  async function acknowledge(request: PosSupplyRequest) {
    const key = `ack-${request.id}`;
    setBusyKey(key);
    setNotice('');
    try {
      const response = await api.post(`/warehouse/supply-requests/${request.id}/acknowledge`, {
        expected_version: request.version,
      });
      replaceRequest(response.data.data as PosSupplyRequest);
      setNotice(`Cambios de la orden #${request.pos_order_number ?? request.pos_order_id} revisados.`);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'No se pudieron confirmar los cambios. Actualizando pedido...'));
      await loadItems();
    } finally {
      setBusyKey('');
    }
  }

  async function toggleItem(request: PosSupplyRequest, item: PosSupplyRequestItem) {
    const key = `item-${item.id}`;
    setBusyKey(key);
    setNotice('');
    try {
      const response = await api.patch(
        `/warehouse/supply-requests/${request.id}/items/${item.id}`,
        {
          expected_version: request.version,
          prepared_quantity: quantitiesMatch(item) && Number(item.requested_quantity) > 0
            ? 0
            : item.requested_quantity,
        },
      );
      replaceRequest(response.data.data as PosSupplyRequest);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'El pedido cambió. Revísalo antes de continuar.'));
      await loadItems();
    } finally {
      setBusyKey('');
    }
  }

  async function markReady(request: PosSupplyRequest) {
    const key = `ready-${request.id}`;
    setBusyKey(key);
    setNotice('');
    try {
      const response = await api.post(`/warehouse/supply-requests/${request.id}/ready`, {
        expected_version: request.version,
      });
      replaceRequest(response.data.data as PosSupplyRequest);
      setNotice(`Orden #${request.pos_order_number ?? request.pos_order_id} lista. El POS ya fue avisado.`);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'No se pudo marcar el pedido como listo.'));
      await loadItems();
    } finally {
      setBusyKey('');
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
        emptyText={user
          ? `Esta bandeja muestra únicamente las órdenes asignadas a ${user.name} (${user.email}).`
          : 'Las órdenes del POS asignadas a este usuario aparecerán aquí.'}
        emptyTitle="No tienes pedidos asignados"
        error={error}
        keyExtractor={(item) => String(item.id)}
        loading={loading}
        onRefresh={() => void loadItems(true)}
        onRetry={() => void loadItems()}
        refreshing={refreshing}
        renderItem={(request) => {
          const needsReview = request.has_unreviewed_changes;
          const ready = request.status === 'ready';

          return (
            <View style={[styles.card, needsReview && styles.changedCard, ready && styles.readyCard]}>
              <View style={styles.cardHeader}>
                <Icon
                  color={needsReview ? '#B4232D' : ready ? '#247451' : '#1F6174'}
                  size={20}
                  source={needsReview ? 'alert-decagram-outline' : ready ? 'package-variant-closed-check' : 'receipt-text-outline'}
                />
                <View style={styles.cardIdentity}>
                  <Text style={styles.cardTitle}>Orden #{request.pos_order_number ?? request.pos_order_id}</Text>
                  <Text style={[styles.status, needsReview && styles.changedStatus, ready && styles.readyStatus]}>
                    {statusLabel(request)}
                  </Text>
                </View>
                <Text style={styles.cardTime}>{formatTime(request.updated_at ?? request.created_at)}</Text>
              </View>

              {request.warehouse_notes ? (
                <View
                  style={[
                    styles.orderNotes,
                    request.warehouse_notes_changed_version > request.acknowledged_version && styles.changedOrderNotes,
                  ]}
                >
                  <Icon color="#1F6174" size={18} source="text-box-outline" />
                  <View style={styles.orderNotesCopy}>
                    <Text style={styles.orderNotesLabel}>Indicaciones generales</Text>
                    <Text style={styles.orderNotesText}>{request.warehouse_notes}</Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.itemList}>
                {request.items.map((item) => {
                  const itemChanged = item.changed_version > request.acknowledged_version;
                  const removed = Number(item.requested_quantity) === 0;
                  const checked = quantitiesMatch(item);

                  return (
                    <View key={item.id} style={[styles.itemRow, itemChanged && styles.changedItem]}>
                      <Checkbox
                        disabled={ready || needsReview || busyKey !== '' || (removed && checked)}
                        onPress={() => void toggleItem(request, item)}
                        status={checked ? 'checked' : 'unchecked'}
                      />
                      <View style={styles.itemCopy}>
                        <View style={styles.itemHeading}>
                          <Text numberOfLines={1} style={[styles.itemName, removed && styles.removedText]}>
                            {item.product?.name ?? `Producto #${item.product_id}`}
                          </Text>
                          {itemChanged ? (
                            <Text style={styles.changeBadge}>{CHANGE_LABELS[item.change_type]}</Text>
                          ) : null}
                        </View>
                        <Text style={styles.itemQuantity}>
                          Preparado {formatQuantity(item, item.prepared_quantity)} de {formatQuantity(item, item.requested_quantity)}
                        </Text>
                        {item.warehouse_notes ? (
                          <View style={styles.itemNotes}>
                            <Icon color="#1F6174" size={14} source="note-text-outline" />
                            <Text style={styles.itemNotesText}>{item.warehouse_notes}</Text>
                          </View>
                        ) : null}
                        {removed && Number(item.prepared_quantity) > 0 ? (
                          <Text style={styles.returnHint}>El POS lo retiró: desmarca para devolverlo.</Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>

              {needsReview ? (
                <Button
                  buttonColor="#B4232D"
                  disabled={busyKey !== '' || ready}
                  icon="eye-check-outline"
                  loading={busyKey === `ack-${request.id}`}
                  mode="contained"
                  onPress={() => void acknowledge(request)}
                  style={styles.button}
                >
                  Revisar cambios
                </Button>
              ) : ready ? (
                <Text style={styles.waitingText}>El pedido desaparecerá cuando el vendedor confirme la recepción.</Text>
              ) : (
                <Button
                  buttonColor="#247451"
                  disabled={busyKey !== '' || !requestComplete(request)}
                  icon="check-bold"
                  loading={busyKey === `ready-${request.id}`}
                  mode="contained"
                  onPress={() => void markReady(request)}
                  style={styles.button}
                >
                  Marcar pedido listo
                </Button>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' },
  notice: { margin: 12, marginBottom: 0, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#247451', borderRadius: 9, backgroundColor: '#E0F3EA' },
  noticeText: { flex: 1, color: '#247451', fontSize: 11, fontWeight: '700' },
  card: { margin: 12, marginBottom: 0, padding: 12, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 12, backgroundColor: '#FFFFFF' },
  changedCard: { borderWidth: 2, borderColor: '#B4232D', backgroundColor: '#FFF8F8' },
  readyCard: { borderColor: '#247451', backgroundColor: '#F3FBF7' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardIdentity: { flex: 1, minWidth: 0 },
  cardTitle: { color: '#172423', fontSize: 14, fontWeight: '900' },
  status: { marginTop: 2, color: '#1F6174', fontSize: 9, fontWeight: '800' },
  changedStatus: { color: '#B4232D' },
  readyStatus: { color: '#247451' },
  cardTime: { color: '#60706E', fontSize: 10, fontWeight: '700' },
  orderNotes: { marginTop: 10, padding: 9, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderColor: '#9CC5D0', borderRadius: 9, backgroundColor: '#EDF7FA' },
  changedOrderNotes: { borderWidth: 2, borderColor: '#B4232D', backgroundColor: '#FCE8EA' },
  orderNotesCopy: { flex: 1, minWidth: 0 },
  orderNotesLabel: { color: '#1F6174', fontSize: 9, fontWeight: '900' },
  orderNotesText: { marginTop: 3, color: '#172423', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  itemList: { marginTop: 10, gap: 7 },
  itemRow: { minHeight: 54, paddingRight: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8E6', borderRadius: 9, backgroundColor: '#FFFFFF' },
  changedItem: { borderColor: '#E9A3AA', backgroundColor: '#FCE8EA' },
  itemCopy: { flex: 1, minWidth: 0, paddingVertical: 7 },
  itemHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemName: { flex: 1, color: '#172423', fontSize: 12, fontWeight: '800' },
  removedText: { textDecorationLine: 'line-through', color: '#60706E' },
  changeBadge: { paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden', borderRadius: 8, backgroundColor: '#B4232D', color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
  itemQuantity: { marginTop: 3, color: '#60706E', fontSize: 10, fontWeight: '700' },
  itemNotes: { marginTop: 5, padding: 6, flexDirection: 'row', alignItems: 'flex-start', gap: 5, borderRadius: 6, backgroundColor: '#EDF7FA' },
  itemNotesText: { flex: 1, color: '#1F6174', fontSize: 10, lineHeight: 14, fontWeight: '700' },
  returnHint: { marginTop: 2, color: '#B4232D', fontSize: 9, fontWeight: '800' },
  button: { marginTop: 12 },
  waitingText: { marginTop: 12, color: '#247451', fontSize: 10, lineHeight: 15, fontWeight: '700', textAlign: 'center' },
});
