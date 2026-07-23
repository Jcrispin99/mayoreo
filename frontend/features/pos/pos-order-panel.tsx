import { useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  Icon,
  IconButton,
  Text,
  TextInput,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatBaseQuantity, isMeasuredProduct, pricingDisplay } from './pos-measurement';
import type { PosOrder, PosOrderItem } from './pos-types';

type PosOrderPanelProps = {
  activeOrderId: number | null;
  busy: boolean;
  loading: boolean;
  onCancelOrder: (order: PosOrder) => void;
  onClose: () => void;
  onCreateOrder: () => void;
  onEditMeasuredItem: (item: PosOrderItem) => void;
  onRemoveItem: (order: PosOrder, item: PosOrderItem) => void;
  onSelectOrder: (orderId: number) => void;
  onUpdateQuantity: (order: PosOrder, item: PosOrderItem, quantity: number) => void;
  orders: PosOrder[];
  visible: boolean;
};

function formatMoney(value: string | number) {
  return `S/ ${(Number(value) || 0).toFixed(2)}`;
}

function formatQuantity(value: string | number) {
  return new Intl.NumberFormat('es-PE', { maximumFractionDigits: 3 }).format(Number(value) || 0);
}

function imageUrlForDevice(url: string) {
  if (Platform.OS !== 'android') return url;
  return url.replace(/https?:\/\/(localhost|127\.0\.0\.1)/, 'http://10.0.2.2');
}

function OrderLine({
  busy,
  item,
  onEditMeasured,
  onRemove,
  onUpdateQuantity,
}: {
  busy: boolean;
  item: PosOrderItem;
  onEditMeasured: () => void;
  onRemove: () => void;
  onUpdateQuantity: (quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState(formatQuantity(item.quantity));
  const numericQuantity = Number(item.quantity);
  const unit = item.product.base_unit?.code ?? item.product.base_unit?.name ?? 'un.';
  const measured = isMeasuredProduct(item.product);
  const priceDisplay = pricingDisplay(item.product.base_unit);
  const displayedUnitPrice = Number(item.unit_price) * priceDisplay.factor;

  useEffect(() => {
    setQuantity(formatQuantity(item.quantity));
  }, [item.quantity]);

  function commitQuantity() {
    const parsed = Number(quantity.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setQuantity(formatQuantity(item.quantity));
      return;
    }
    if (Math.abs(parsed - numericQuantity) > 0.000001) onUpdateQuantity(parsed);
  }

  return (
    <View style={styles.line}>
      <View style={styles.lineImage}>
        {item.product.image_url ? (
          <Image
            accessibilityLabel={`Imagen de ${item.product.name}`}
            resizeMode="cover"
            source={{ uri: imageUrlForDevice(item.product.image_url) }}
            style={styles.image}
          />
        ) : (
          <Icon color="#9AA4A8" size={28} source="image-outline" />
        )}
      </View>

      <View style={styles.lineContent}>
        <View style={styles.lineHeading}>
          <View style={styles.lineIdentity}>
            <Text numberOfLines={2} style={styles.lineName}>{item.product.name}</Text>
            <Text numberOfLines={1} style={styles.lineSku}>{item.product.sku}</Text>
          </View>
          <IconButton
            accessibilityLabel={`Retirar ${item.product.name}`}
            disabled={busy}
            icon="trash-can-outline"
            iconColor="#A44256"
            onPress={onRemove}
            size={18}
            style={styles.removeButton}
          />
        </View>

        {measured ? (
          <Pressable
            accessibilityLabel={`Editar medida de ${item.product.name}`}
            disabled={busy}
            onPress={onEditMeasured}
            style={({ pressed }) => [styles.measuredQuantity, pressed && styles.measuredQuantityPressed]}
          >
            <Icon color="#28738A" size={18} source={item.product.base_unit?.type === 'weight' ? 'weight' : 'cup-water'} />
            <View style={styles.measuredQuantityText}>
              <Text style={styles.measuredQuantityValue}>
                {formatBaseQuantity(numericQuantity, item.product.base_unit)}
              </Text>
              <Text style={styles.measuredQuantityHelp}>Toca para cambiar unidad o cantidad</Text>
            </View>
            <Icon color="#6F7A7E" size={17} source="pencil-outline" />
          </Pressable>
        ) : (
          <View style={styles.quantityRow}>
            <IconButton
              accessibilityLabel={`Reducir cantidad de ${item.product.name}`}
              disabled={busy || numericQuantity <= 1}
              icon="minus"
              mode="outlined"
              onPress={() => onUpdateQuantity(Math.max(1, numericQuantity - 1))}
              size={16}
              style={styles.quantityButton}
            />
            <TextInput
              dense
              disabled={busy}
              keyboardType="decimal-pad"
              mode="outlined"
              onBlur={commitQuantity}
              onChangeText={setQuantity}
              onSubmitEditing={commitQuantity}
              outlineColor="#D6DDE0"
              selectTextOnFocus
              style={styles.quantityInput}
              value={quantity}
            />
            <IconButton
              accessibilityLabel={`Aumentar cantidad de ${item.product.name}`}
              disabled={busy}
              icon="plus"
              mode="outlined"
              onPress={() => onUpdateQuantity(numericQuantity + 1)}
              size={16}
              style={styles.quantityButton}
            />
            <Text style={styles.unit}>{unit}</Text>
          </View>
        )}

        <View style={styles.lineTotals}>
          <Text style={styles.unitPrice}>
            {measured
              ? `${formatMoney(displayedUnitPrice)} / ${priceDisplay.unit}`
              : `${formatMoney(item.unit_price)} c/u`}
          </Text>
          <Text style={styles.lineTotal}>{formatMoney(item.line_total)}</Text>
        </View>
      </View>
    </View>
  );
}

export function PosOrderPanel({
  activeOrderId,
  busy,
  loading,
  onCancelOrder,
  onClose,
  onCreateOrder,
  onEditMeasuredItem,
  onRemoveItem,
  onSelectOrder,
  onUpdateQuantity,
  orders,
  visible,
}: PosOrderPanelProps) {
  const [cancelVisible, setCancelVisible] = useState(false);
  const activeOrder = orders.find((order) => order.id === activeOrderId) ?? orders[0] ?? null;

  useEffect(() => {
    if (!visible) setCancelVisible(false);
  }, [visible]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" visible={visible}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Órdenes</Text>
              <Text style={styles.subtitle}>Productos preparados antes del cobro</Text>
            </View>
            <IconButton
              accessibilityLabel="Cerrar órdenes"
              icon="close"
              onPress={onClose}
              size={22}
              style={styles.closeButton}
            />
          </View>

          <View style={styles.orderTabs}>
            <ScrollView
              contentContainerStyle={styles.orderTabsContent}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {orders.map((order) => {
                const selected = order.id === activeOrder?.id;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={order.id}
                    onPress={() => onSelectOrder(order.id)}
                    style={[styles.orderTab, selected && styles.orderTabSelected]}
                  >
                    <Icon color={selected ? '#FFFFFF' : '#556167'} size={17} source="receipt-text-outline" />
                    <Text style={[styles.orderTabText, selected && styles.orderTabTextSelected]}>
                      Orden {order.number}
                    </Text>
                    {order.items.length > 0 ? (
                      <View style={[styles.orderCount, selected && styles.orderCountSelected]}>
                        <Text style={[styles.orderCountText, selected && styles.orderCountTextSelected]}>
                          {order.items.length}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
              <Pressable
                accessibilityLabel="Crear otra orden"
                accessibilityRole="button"
                disabled={busy}
                onPress={onCreateOrder}
                style={styles.newOrderTab}
              >
                <Icon color="#28738A" size={18} source="plus" />
                <Text style={styles.newOrderText}>Nueva</Text>
              </Pressable>
            </ScrollView>
          </View>

          {loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color="#28738A" size="large" />
              <Text style={styles.emptyTitle}>Cargando órdenes</Text>
            </View>
          ) : !activeOrder ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon color="#28738A" size={42} source="receipt-text-plus-outline" />
              </View>
              <Text style={styles.emptyTitle}>Todavía no hay órdenes</Text>
              <Text style={styles.emptyText}>
                Crea una orden o cierra esta pantalla y toca un producto para comenzar.
              </Text>
              <Button
                buttonColor="#28738A"
                disabled={busy}
                icon="plus"
                mode="contained"
                onPress={onCreateOrder}
              >
                Nueva orden
              </Button>
            </View>
          ) : (
            <>
              <View style={styles.orderSummary}>
                <View>
                  <Text style={styles.orderLabel}>Orden {activeOrder.number}</Text>
                  <Text style={styles.orderDetail}>
                    {activeOrder.items.length} {activeOrder.items.length === 1 ? 'producto' : 'productos'}
                  </Text>
                </View>
                <Text style={styles.orderTotal}>{formatMoney(activeOrder.total)}</Text>
              </View>

              <FlatList
                contentContainerStyle={activeOrder.items.length === 0 ? styles.emptyLines : styles.lines}
                data={activeOrder.items}
                keyExtractor={(item) => String(item.id)}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={(
                  <View style={styles.empty}>
                    <Icon color="#A2AAAE" size={42} source="basket-plus-outline" />
                    <Text style={styles.emptyTitle}>Orden vacía</Text>
                    <Text style={styles.emptyText}>Cierra este panel y toca los productos que deseas agregar.</Text>
                  </View>
                )}
                renderItem={({ item }) => (
                  <OrderLine
                    busy={busy}
                    item={item}
                    onEditMeasured={() => onEditMeasuredItem(item)}
                    onRemove={() => onRemoveItem(activeOrder, item)}
                    onUpdateQuantity={(quantity) => onUpdateQuantity(activeOrder, item, quantity)}
                  />
                )}
                showsVerticalScrollIndicator={false}
              />

              <View style={styles.footer}>
                <View>
                  <Text style={styles.footerLabel}>Total de la orden</Text>
                  <Text style={styles.footerHint}>El cobro se habilitará en la siguiente etapa.</Text>
                </View>
                <Text style={styles.footerTotal}>{formatMoney(activeOrder.total)}</Text>
                {cancelVisible ? (
                  <View style={styles.cancelConfirmation}>
                    <Text style={styles.cancelText}>
                      ¿Cancelar esta orden? El stock no será modificado.
                    </Text>
                    <View style={styles.cancelActions}>
                      <Button compact disabled={busy} onPress={() => setCancelVisible(false)}>
                        Volver
                      </Button>
                      <Button
                        buttonColor="#A44256"
                        compact
                        disabled={busy}
                        loading={busy}
                        mode="contained"
                        onPress={() => {
                          setCancelVisible(false);
                          onCancelOrder(activeOrder);
                        }}
                      >
                        Confirmar
                      </Button>
                    </View>
                  </View>
                ) : (
                  <Button
                    compact
                    disabled={busy}
                    icon="close-circle-outline"
                    mode="text"
                    onPress={() => setCancelVisible(true)}
                    textColor="#A44256"
                  >
                    Cancelar orden
                  </Button>
                )}
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export function PosOrderDock({
  onPress,
  order,
}: {
  onPress: () => void;
  order: PosOrder;
}) {
  return (
    <Pressable
      accessibilityLabel={`Abrir orden ${order.number}`}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.dock}
    >
      <View style={styles.dockIcon}>
        <Icon color="#FFFFFF" size={20} source="receipt-text-outline" />
        <View style={styles.dockCount}>
          <Text style={styles.dockCountText}>{order.items.length}</Text>
        </View>
      </View>
      <View style={styles.dockText}>
        <Text style={styles.dockTitle}>Orden {order.number}</Text>
        <Text style={styles.dockSubtitle}>Toca para revisar productos y cantidades</Text>
      </View>
      <Text style={styles.dockTotal}>{formatMoney(order.total)}</Text>
      <Icon color="#FFFFFF" size={20} source="chevron-up" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: '#F6F8F9' },
  header: { minHeight: 66, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: '#DDE4E6', backgroundColor: '#FFFFFF' },
  title: { color: '#302A33', fontSize: 18, fontWeight: '900' },
  subtitle: { marginTop: 2, color: '#7A8387', fontSize: 9 },
  closeButton: { margin: 0, backgroundColor: '#ECEFF0' },
  orderTabs: { borderBottomWidth: 1, borderBottomColor: '#E0E6E8', backgroundColor: '#FFFFFF' },
  orderTabsContent: { paddingHorizontal: 12, paddingVertical: 9, gap: 7 },
  orderTab: { minHeight: 34, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#D5DCDF', borderRadius: 17, backgroundColor: '#FFFFFF' },
  orderTabSelected: { borderColor: '#28738A', backgroundColor: '#28738A' },
  orderTabText: { color: '#556167', fontSize: 10, fontWeight: '800' },
  orderTabTextSelected: { color: '#FFFFFF' },
  orderCount: { minWidth: 18, height: 18, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#EDF1F2' },
  orderCountSelected: { backgroundColor: '#FFFFFF' },
  orderCountText: { color: '#586267', fontSize: 8, fontWeight: '900' },
  orderCountTextSelected: { color: '#28738A' },
  newOrderTab: { minHeight: 34, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#AFCBD3', borderRadius: 17, backgroundColor: '#EFF7F9' },
  newOrderText: { color: '#28738A', fontSize: 10, fontWeight: '900' },
  orderSummary: { paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#E2E7E9', backgroundColor: '#F9FBFB' },
  orderLabel: { color: '#384348', fontSize: 13, fontWeight: '900' },
  orderDetail: { marginTop: 2, color: '#899196', fontSize: 9 },
  orderTotal: { color: '#76557E', fontSize: 18, fontWeight: '900' },
  lines: { padding: 12, gap: 8 },
  emptyLines: { flexGrow: 1 },
  line: { padding: 9, flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: '#DEE5E7', borderRadius: 10, backgroundColor: '#FFFFFF' },
  lineImage: { width: 62, height: 62, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#EEF2F3' },
  image: { width: '100%', height: '100%' },
  lineContent: { flex: 1, minWidth: 0 },
  lineHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  lineIdentity: { flex: 1, minWidth: 0 },
  lineName: { color: '#302A33', fontSize: 12, lineHeight: 16, fontWeight: '900' },
  lineSku: { marginTop: 2, color: '#858D91', fontSize: 8, fontWeight: '700' },
  removeButton: { width: 30, height: 30, margin: 0 },
  quantityRow: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 5 },
  measuredQuantity: { minHeight: 42, marginTop: 7, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#C7D9DE', borderRadius: 9, backgroundColor: '#F0F8F9' },
  measuredQuantityPressed: { backgroundColor: '#E3F1F4' },
  measuredQuantityText: { flex: 1, minWidth: 0 },
  measuredQuantityValue: { color: '#28738A', fontSize: 11, fontWeight: '900' },
  measuredQuantityHelp: { marginTop: 1, color: '#758085', fontSize: 7 },
  quantityButton: { width: 30, height: 30, margin: 0 },
  quantityInput: { width: 76, height: 34, backgroundColor: '#FFFFFF', fontSize: 11, textAlign: 'center' },
  unit: { maxWidth: 55, color: '#6F797D', fontSize: 9, fontWeight: '700' },
  lineTotals: { marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  unitPrice: { color: '#7D878B', fontSize: 9 },
  lineTotal: { color: '#76557E', fontSize: 12, fontWeight: '900' },
  empty: { flex: 1, minHeight: 220, padding: 26, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyIcon: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', borderRadius: 38, backgroundColor: '#E8F3F5' },
  emptyTitle: { color: '#465156', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  emptyText: { maxWidth: 330, color: '#858E92', fontSize: 10, lineHeight: 16, textAlign: 'center' },
  footer: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#DDE4E6', backgroundColor: '#FFFFFF' },
  footerLabel: { color: '#697377', fontSize: 9, fontWeight: '800' },
  footerHint: { marginTop: 2, color: '#969DA0', fontSize: 8 },
  footerTotal: { position: 'absolute', top: 13, right: 16, color: '#76557E', fontSize: 18, fontWeight: '900' },
  cancelConfirmation: { marginTop: 7, padding: 9, borderRadius: 7, backgroundColor: '#FBF1F3' },
  cancelText: { color: '#874052', fontSize: 9, fontWeight: '700' },
  cancelActions: { marginTop: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  dock: { minHeight: 58, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#28738A' },
  dockIcon: { position: 'relative', width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#1F6174' },
  dockCount: { position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#D18A25' },
  dockCountText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
  dockText: { flex: 1, minWidth: 0 },
  dockTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  dockSubtitle: { marginTop: 2, color: '#D5E7EC', fontSize: 8 },
  dockTotal: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
