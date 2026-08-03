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
  Dialog,
  Icon,
  IconButton,
  Menu,
  Portal,
  Text,
  TextInput,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatBaseQuantity, isMeasuredProduct, pricingDisplay } from './pos-measurement';
import { formatPosMoney as formatMoney } from './pos-money';
import { PosCustomerSelector } from './pos-customer-selector';
import type { Customer } from '../customers/customer-types';
import type { PosSupplyRequest, PosSupplyRequestStatus, WarehouseAssignee } from '../inventory/inventory-types';
import type { PosOrder, PosOrderItem } from './pos-types';

type PosOrderPanelProps = {
  activeOrderId: number | null;
  busy: boolean;
  loading: boolean;
  notice: { message: string; error: boolean } | null;
  onAddProducts: (order: PosOrder) => void;
  onCancelOrder: (order: PosOrder) => void;
  onClose: () => void;
  onCreateOrder: () => void;
  onCheckout: (order: PosOrder) => void;
  onDismissNotice: () => void;
  onEditMeasuredItem: (item: PosOrderItem) => void;
  onRemoveItem: (order: PosOrder, item: PosOrderItem) => void;
  onReceiveSupply: (order: PosOrder, request: PosSupplyRequest) => void;
  onRequestSupply: (order: PosOrder, assignedTo: number) => void;
  onSelectOrder: (orderId: number) => void;
  onUpdateQuantity: (order: PosOrder, item: PosOrderItem, quantity: number) => void;
  onUpdateCustomer: (order: PosOrder, customer: Customer | null) => Promise<boolean>;
  onUpdateItemWarehouseNotes: (order: PosOrder, item: PosOrderItem, notes: string) => Promise<boolean>;
  orders: PosOrder[];
  onUpdateWarehouseNotes: (order: PosOrder, notes: string) => Promise<boolean>;
  sessionOpen: boolean;
  visible: boolean;
  warehouseAssignees: WarehouseAssignee[];
};

const ACTIVE_SUPPLY_STATUSES: PosSupplyRequestStatus[] = [
  'assigned',
  'preparing',
  'changes_pending',
  'ready',
];

function supplyProgress(request: PosSupplyRequest) {
  const requested = request.items.filter((item) => Number(item.requested_quantity) > 0);
  const prepared = requested.filter(
    (item) => Math.abs(Number(item.prepared_quantity) - Number(item.requested_quantity)) < 0.000001,
  );

  return `${prepared.length}/${requested.length}`;
}

function supplyMessage(request: PosSupplyRequest) {
  switch (request.status) {
    case 'assigned':
      return 'Pedido enviado. Esperando que almacén lo revise.';
    case 'preparing':
      return `Almacén está preparando el pedido (${supplyProgress(request)} productos).`;
    case 'changes_pending':
      return 'Tus cambios fueron enviados. Almacén debe revisarlos antes de continuar.';
    case 'ready':
      return 'Almacén terminó el pedido. Confirma cuando lo recibas.';
    default:
      return 'Pedido en proceso.';
  }
}

function formatQuantity(value: string | number) {
  return new Intl.NumberFormat('es-PE', { maximumFractionDigits: 3 }).format(Number(value) || 0);
}

function packagedQuantitySummary(item: PosOrderItem) {
  const content = Number(item.product.content_quantity);
  const quantity = Number(item.quantity);
  const contentUnit = item.product.content_unit?.code;
  if (!Number.isFinite(content) || content <= 0 || !Number.isFinite(quantity) || !contentUnit) return null;

  return `${formatQuantity(quantity)} × ${formatQuantity(content)} ${contentUnit} = ${formatQuantity(content * quantity)} ${contentUnit}`;
}

function imageUrlForDevice(url: string) {
  if (Platform.OS !== 'android') return url;
  return url.replace(/https?:\/\/(localhost|127\.0\.0\.1)/, 'http://10.0.2.2');
}

function OrderLine({
  busy,
  item,
  onEditMeasured,
  onEditWarehouseNotes,
  onRemove,
  onUpdateQuantity,
}: {
  busy: boolean;
  item: PosOrderItem;
  onEditMeasured: () => void;
  onEditWarehouseNotes: () => void;
  onRemove: () => void;
  onUpdateQuantity: (quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState(formatQuantity(item.quantity));
  const numericQuantity = Number(item.quantity);
  const unit = item.product.base_unit?.code ?? item.product.base_unit?.name ?? 'un.';
  const measured = isMeasuredProduct(item.product);
  const priceDisplay = pricingDisplay(item.product.base_unit);
  const displayedUnitPrice = Number(item.unit_price) * priceDisplay.factor;
  const packageSummary = packagedQuantitySummary(item);

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
          <Icon color="#60706E" size={28} source="image-outline" />
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
            iconColor="#8F1D2C"
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
            <Icon color="#B4232D" size={18} source={item.product.base_unit?.type === 'weight' ? 'weight' : 'cup-water'} />
            <View style={styles.measuredQuantityText}>
              <Text style={styles.measuredQuantityValue}>
                {formatBaseQuantity(numericQuantity, item.product.base_unit)}
              </Text>
              <Text style={styles.measuredQuantityHelp}>Toca para cambiar unidad o cantidad</Text>
            </View>
            <Icon color="#60706E" size={17} source="pencil-outline" />
          </Pressable>
        ) : (
          <View>
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
                keyboardType="number-pad"
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
            {packageSummary ? <Text style={styles.packageSummary}>{packageSummary}</Text> : null}
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
        <Pressable
          accessibilityLabel={`Editar indicación para almacén de ${item.product.name}`}
          disabled={busy}
          onPress={onEditWarehouseNotes}
          style={({ pressed }) => [styles.lineNote, pressed && styles.lineNotePressed]}
        >
          <Icon color={item.warehouse_notes ? '#1F6174' : '#60706E'} size={17} source="note-edit-outline" />
          <Text
            numberOfLines={2}
            style={[styles.lineNoteText, item.warehouse_notes && styles.lineNoteTextFilled]}
          >
            {item.warehouse_notes ?? 'Agregar indicación para almacén'}
          </Text>
          <Icon color="#60706E" size={15} source="chevron-right" />
        </Pressable>
      </View>
    </View>
  );
}

export function PosOrderPanel({
  activeOrderId,
  busy,
  loading,
  notice,
  onAddProducts,
  onCancelOrder,
  onClose,
  onCreateOrder,
  onCheckout,
  onDismissNotice,
  onEditMeasuredItem,
  onRemoveItem,
  onReceiveSupply,
  onRequestSupply,
  onSelectOrder,
  onUpdateCustomer,
  onUpdateItemWarehouseNotes,
  onUpdateQuantity,
  onUpdateWarehouseNotes,
  orders,
  sessionOpen,
  visible,
  warehouseAssignees,
}: PosOrderPanelProps) {
  const [cancelVisible, setCancelVisible] = useState(false);
  const [customerSelectorVisible, setCustomerSelectorVisible] = useState(false);
  const [assigneeMenuVisible, setAssigneeMenuVisible] = useState(false);
  const [noteEditor, setNoteEditor] = useState<{ kind: 'order' } | { kind: 'item'; item: PosOrderItem } | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const activeOrder = orders.find((order) => order.id === activeOrderId) ?? orders[0] ?? null;
  const pendingSupplyRequest = activeOrder?.supply_requests?.find(
    (request) => ACTIVE_SUPPLY_STATUSES.includes(request.status),
  ) ?? null;

  useEffect(() => {
    if (!visible) {
      setCancelVisible(false);
      setCustomerSelectorVisible(false);
      setAssigneeMenuVisible(false);
      setNoteEditor(null);
    }
  }, [visible]);

  function editOrderNotes() {
    setNoteDraft(activeOrder?.warehouse_notes ?? '');
    setNoteEditor({ kind: 'order' });
  }

  function editItemNotes(item: PosOrderItem) {
    setNoteDraft(item.warehouse_notes ?? '');
    setNoteEditor({ kind: 'item', item });
  }

  async function saveNotes() {
    if (!activeOrder || !noteEditor) return;

    setNoteSaving(true);
    const saved = noteEditor.kind === 'order'
      ? await onUpdateWarehouseNotes(activeOrder, noteDraft)
      : await onUpdateItemWarehouseNotes(activeOrder, noteEditor.item, noteDraft);
    setNoteSaving(false);
    if (saved) setNoteEditor(null);
  }

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
                    <Icon color={selected ? '#FFFFFF' : '#60706E'} size={17} source="receipt-text-outline" />
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
                <Icon color="#0F766E" size={18} source="plus" />
                <Text style={styles.newOrderText}>Nueva</Text>
              </Pressable>
            </ScrollView>
          </View>

          {notice ? (
            <View
              accessibilityLiveRegion="polite"
              style={[styles.notice, notice.error ? styles.errorNotice : styles.successNotice]}
            >
              <Icon
                color={notice.error ? '#8F1D2C' : '#247451'}
                size={20}
                source={notice.error ? 'alert-circle-outline' : 'check-circle-outline'}
              />
              <Text style={[styles.noticeText, notice.error ? styles.errorNoticeText : styles.successNoticeText]}>
                {notice.message}
              </Text>
              <IconButton
                accessibilityLabel="Cerrar mensaje"
                icon="close"
                onPress={onDismissNotice}
                size={17}
                style={styles.noticeClose}
              />
            </View>
          ) : null}

          {loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color="#B4232D" size="large" />
              <Text style={styles.emptyTitle}>Cargando órdenes</Text>
            </View>
          ) : !activeOrder ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon color="#B4232D" size={42} source="receipt-text-plus-outline" />
              </View>
              <Text style={styles.emptyTitle}>Todavía no hay órdenes</Text>
              <Text style={styles.emptyText}>
                Crea una orden o cierra esta pantalla y toca un producto para comenzar.
              </Text>
              <Button
                buttonColor="#FF4D4D"
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
              <View style={styles.customerBar}>
                <View style={styles.customerBarIcon}>
                  <Icon
                    color="#B4232D"
                    size={25}
                    source={activeOrder.customer ? 'account-check-outline' : 'account-outline'}
                  />
                </View>
                <View style={styles.customerBarCopy}>
                  <Text numberOfLines={1} style={styles.customerBarName}>
                    {activeOrder.customer?.name ?? 'Cliente'}
                  </Text>
                  <Text numberOfLines={1} style={styles.customerBarMeta}>
                    {activeOrder.customer
                      ? activeOrder.customer.document_number || activeOrder.customer.phone || activeOrder.customer.email || 'Cliente registrado'
                      : 'Venta al público general'}
                  </Text>
                </View>
                <Button
                  compact
                  disabled={busy || !sessionOpen}
                  icon={activeOrder.customer ? 'account-edit-outline' : 'account-outline'}
                  mode={activeOrder.customer ? 'text' : 'contained-tonal'}
                  onPress={() => setCustomerSelectorVisible(true)}
                >
                  {activeOrder.customer ? 'Cambiar' : '+ Agregar'}
                </Button>
              </View>

              <View style={styles.orderSummary}>
                <View style={styles.orderSummaryInfo}>
                  <Text style={styles.orderLabel}>Orden {activeOrder.number}</Text>
                  <Text style={styles.orderDetail}>
                    {activeOrder.items.length} {activeOrder.items.length === 1 ? 'producto' : 'productos'}
                  </Text>
                </View>
                <Button
                  buttonColor="#D9F8F3"
                  compact
                  disabled={busy || !sessionOpen}
                  icon="plus"
                  mode="contained"
                  onPress={() => onAddProducts(activeOrder)}
                  textColor="#0F766E"
                >
                  Agregar
                </Button>
                <Text style={styles.orderTotal}>{formatMoney(activeOrder.total)}</Text>
              </View>

              <Pressable
                accessibilityLabel="Editar indicaciones generales para almacén"
                disabled={busy}
                onPress={editOrderNotes}
                style={({ pressed }) => [styles.orderNote, pressed && styles.orderNotePressed]}
              >
                <View style={styles.orderNoteIcon}>
                  <Icon color="#1F6174" size={19} source="text-box-edit-outline" />
                </View>
                <View style={styles.orderNoteCopy}>
                  <Text style={styles.orderNoteLabel}>Indicaciones generales para almacén</Text>
                  <Text numberOfLines={2} style={styles.orderNoteText}>
                    {activeOrder.warehouse_notes ?? 'Toca para agregar una indicación para todo el pedido.'}
                  </Text>
                </View>
                <Icon color="#60706E" size={18} source="chevron-right" />
              </Pressable>

              <FlatList
                contentContainerStyle={activeOrder.items.length === 0 ? styles.emptyLines : styles.lines}
                data={activeOrder.items}
                keyExtractor={(item) => String(item.id)}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={(
                  <View style={styles.empty}>
                    <Icon color="#60706E" size={42} source="basket-plus-outline" />
                    <Text style={styles.emptyTitle}>Orden vacía</Text>
                    <Text style={styles.emptyText}>Cierra este panel y toca los productos que deseas agregar.</Text>
                  </View>
                )}
                renderItem={({ item }) => (
                  <OrderLine
                    busy={busy}
                    item={item}
                    onEditMeasured={() => onEditMeasuredItem(item)}
                    onEditWarehouseNotes={() => editItemNotes(item)}
                    onRemove={() => onRemoveItem(activeOrder, item)}
                    onUpdateQuantity={(quantity) => onUpdateQuantity(activeOrder, item, quantity)}
                  />
                )}
                showsVerticalScrollIndicator={false}
              />

              <View style={styles.footer}>
                {pendingSupplyRequest ? (
                  <View style={styles.supplyBanner}>
                    {pendingSupplyRequest.status === 'ready' ? (
                      <Icon color="#247451" size={19} source="package-variant-closed-check" />
                    ) : (
                      <ActivityIndicator color="#8A5A32" size={16} />
                    )}
                    <Text style={styles.supplyBannerText}>
                      {supplyMessage(pendingSupplyRequest)}
                    </Text>
                    {pendingSupplyRequest.status === 'ready' ? (
                      <Button
                        compact
                        disabled={busy}
                        loading={busy}
                        mode="contained"
                        onPress={() => onReceiveSupply(activeOrder, pendingSupplyRequest)}
                      >
                        Recibido
                      </Button>
                    ) : null}
                  </View>
                ) : null}
                <View style={styles.footerHeading}>
                  <View>
                    <Text style={styles.footerLabel}>Total de la orden</Text>
                    <Text style={styles.footerHint}>
                      {activeOrder.items.length === 0
                        ? 'Agrega al menos un producto para cobrar.'
                        : pendingSupplyRequest
                          ? 'No se puede cobrar hasta que llegue el stock pedido.'
                          : 'Revisa el pago antes de confirmar la venta.'}
                    </Text>
                  </View>
                  <Text style={styles.footerTotal}>{formatMoney(activeOrder.total)}</Text>
                </View>
                <Button
                  buttonColor="#FF4D4D"
                  contentStyle={styles.checkoutButtonContent}
                  disabled={
                    busy
                    || cancelVisible
                    || !sessionOpen
                    || activeOrder.items.length === 0
                    || Boolean(pendingSupplyRequest)
                  }
                  icon="cash-register"
                  mode="contained"
                  onPress={() => onCheckout(activeOrder)}
                  style={styles.checkoutButton}
                >
                  Cobrar · {formatMoney(activeOrder.total)}
                </Button>
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
                        buttonColor="#8F1D2C"
                        compact
                        disabled={busy}
                        loading={busy}
                        mode="contained"
                        onPress={() => {
                          setCancelVisible(false);
                          onCancelOrder(activeOrder);
                        }}
                        textColor="#FFFFFF"
                      >
                        Confirmar
                      </Button>
                    </View>
                  </View>
                ) : (
                  <View style={styles.footerActions}>
                    <Button
                      compact
                      disabled={busy}
                      icon="close-circle-outline"
                      mode="text"
                      onPress={() => setCancelVisible(true)}
                      textColor="#8F1D2C"
                    >
                      Cancelar orden
                    </Button>
                    {!pendingSupplyRequest && activeOrder.items.length > 0 ? (
                      <Menu
                        anchor={(
                          <Button
                            compact
                            disabled={busy || warehouseAssignees.length === 0}
                            icon="truck-delivery-outline"
                            mode="text"
                            onPress={() => setAssigneeMenuVisible(true)}
                            textColor="#1F6174"
                          >
                            {warehouseAssignees.length === 0 ? 'Sin almaceneros' : 'Pedir al almacén'}
                          </Button>
                        )}
                        anchorPosition="top"
                        onDismiss={() => setAssigneeMenuVisible(false)}
                        visible={assigneeMenuVisible}
                      >
                        {warehouseAssignees.map((assignee) => (
                          <Menu.Item
                            key={assignee.id}
                            leadingIcon="account-outline"
                            onPress={() => {
                              setAssigneeMenuVisible(false);
                              onRequestSupply(activeOrder, assignee.id);
                            }}
                            title={assignee.name}
                          />
                        ))}
                      </Menu>
                    ) : null}
                  </View>
                )}
              </View>

              <PosCustomerSelector
                onClose={() => setCustomerSelectorVisible(false)}
                onSelect={(customer) => onUpdateCustomer(activeOrder, customer)}
                selectedCustomer={activeOrder.customer}
                visible={customerSelectorVisible}
              />

              <Portal>
                <Dialog onDismiss={() => !noteSaving && setNoteEditor(null)} visible={noteEditor !== null}>
                  <Dialog.Icon icon={noteEditor?.kind === 'order' ? 'text-box-edit-outline' : 'note-edit-outline'} />
                  <Dialog.Title style={styles.noteDialogTitle}>
                    {noteEditor?.kind === 'order'
                      ? 'Indicaciones del pedido'
                      : `Indicación de ${noteEditor?.item.product.name ?? 'producto'}`}
                  </Dialog.Title>
                  <Dialog.Content>
                    <Text style={styles.noteDialogHelp}>
                      Esta información será visible para la persona de almacén asignada.
                    </Text>
                    <TextInput
                      autoFocus
                      disabled={noteSaving}
                      label="Indicación para almacén"
                      maxLength={noteEditor?.kind === 'order' ? 1000 : 500}
                      mode="outlined"
                      multiline
                      numberOfLines={4}
                      onChangeText={setNoteDraft}
                      style={styles.noteInput}
                      value={noteDraft}
                    />
                  </Dialog.Content>
                  <Dialog.Actions>
                    <Button disabled={noteSaving} onPress={() => setNoteEditor(null)}>Cancelar</Button>
                    <Button loading={noteSaving} mode="contained" onPress={() => void saveNotes()}>
                      Guardar
                    </Button>
                  </Dialog.Actions>
                </Dialog>
              </Portal>
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
  screen: { flex: 1, backgroundColor: '#F3F6F5' },
  header: { minHeight: 66, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: '#D7E0DE', backgroundColor: '#FFFFFF' },
  title: { color: '#172423', fontSize: 18, fontWeight: '900' },
  subtitle: { marginTop: 2, color: '#60706E', fontSize: 9 },
  closeButton: { margin: 0, backgroundColor: '#EAEFEE' },
  orderTabs: { borderBottomWidth: 1, borderBottomColor: '#D7E0DE', backgroundColor: '#FFFFFF' },
  orderTabsContent: { paddingHorizontal: 12, paddingVertical: 9, gap: 7 },
  orderTab: { minHeight: 34, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#D5DCDF', borderRadius: 17, backgroundColor: '#FFFFFF' },
  orderTabSelected: { borderColor: '#B4232D', backgroundColor: '#B4232D' },
  orderTabText: { color: '#60706E', fontSize: 10, fontWeight: '800' },
  orderTabTextSelected: { color: '#FFFFFF' },
  orderCount: { minWidth: 18, height: 18, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#EAEFEE' },
  orderCountSelected: { backgroundColor: '#FFFFFF' },
  orderCountText: { color: '#586267', fontSize: 8, fontWeight: '900' },
  orderCountTextSelected: { color: '#B4232D' },
  newOrderTab: { minHeight: 34, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#0F766E', borderRadius: 17, backgroundColor: '#D9F8F3' },
  newOrderText: { color: '#0F766E', fontSize: 10, fontWeight: '900' },
  notice: { marginHorizontal: 12, marginTop: 10, paddingLeft: 11, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10 },
  errorNotice: { borderColor: '#8F1D2C', backgroundColor: '#FCE8EA' },
  successNotice: { borderColor: '#247451', backgroundColor: '#E0F3EA' },
  noticeText: { flex: 1, fontSize: 10, lineHeight: 15, fontWeight: '700' },
  errorNoticeText: { color: '#8F1D2C' },
  successNoticeText: { color: '#247451' },
  noticeClose: { width: 32, height: 32, margin: 0 },
  orderSummary: { paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottomWidth: 1, borderBottomColor: '#D7E0DE', backgroundColor: '#F9FBFB' },
  orderSummaryInfo: { flex: 1, minWidth: 0 },
  orderLabel: { color: '#172423', fontSize: 13, fontWeight: '900' },
  orderDetail: { marginTop: 2, color: '#60706E', fontSize: 9 },
  orderTotal: { color: '#B4232D', fontSize: 18, fontWeight: '900' },
  orderNote: { minHeight: 58, paddingHorizontal: 16, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#D7E0DE', backgroundColor: '#EDF7FA' },
  orderNotePressed: { backgroundColor: '#DDEFF4' },
  orderNoteIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#D5E7EC' },
  orderNoteCopy: { flex: 1, minWidth: 0 },
  orderNoteLabel: { color: '#1F6174', fontSize: 9, fontWeight: '900' },
  orderNoteText: { marginTop: 2, color: '#415250', fontSize: 9, lineHeight: 13 },
  customerBar: { minHeight: 64, paddingHorizontal: 16, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#D7E0DE', backgroundColor: '#FFFFFF' },
  customerBarIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#FFE5E5' },
  customerBarCopy: { flex: 1, minWidth: 0 },
  customerBarName: { color: '#172423', fontSize: 13, fontWeight: '900' },
  customerBarMeta: { marginTop: 2, color: '#60706E', fontSize: 10 },
  lines: { padding: 12, gap: 8 },
  emptyLines: { flexGrow: 1 },
  line: { padding: 9, flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 10, backgroundColor: '#FFFFFF' },
  lineImage: { width: 62, height: 62, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#EAEFEE' },
  image: { width: '100%', height: '100%' },
  lineContent: { flex: 1, minWidth: 0 },
  lineHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  lineIdentity: { flex: 1, minWidth: 0 },
  lineName: { color: '#172423', fontSize: 12, lineHeight: 16, fontWeight: '900' },
  lineSku: { marginTop: 2, color: '#60706E', fontSize: 8, fontWeight: '700' },
  removeButton: { width: 30, height: 30, margin: 0 },
  quantityRow: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 5 },
  measuredQuantity: { minHeight: 42, marginTop: 7, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#879692', borderRadius: 9, backgroundColor: '#FFE5E5' },
  measuredQuantityPressed: { backgroundColor: '#FFE5E5' },
  measuredQuantityText: { flex: 1, minWidth: 0 },
  measuredQuantityValue: { color: '#B4232D', fontSize: 11, fontWeight: '900' },
  measuredQuantityHelp: { marginTop: 1, color: '#60706E', fontSize: 7 },
  quantityButton: { width: 30, height: 30, margin: 0 },
  quantityInput: { width: 76, height: 34, backgroundColor: '#FFFFFF', fontSize: 11, textAlign: 'center' },
  unit: { maxWidth: 55, color: '#60706E', fontSize: 9, fontWeight: '700' },
  packageSummary: { marginTop: 5, color: '#0F766E', fontSize: 10, fontWeight: '800' },
  lineTotals: { marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  unitPrice: { color: '#60706E', fontSize: 9 },
  lineTotal: { color: '#B4232D', fontSize: 12, fontWeight: '900' },
  lineNote: { minHeight: 38, marginTop: 8, paddingHorizontal: 9, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 8, backgroundColor: '#F7FAFA' },
  lineNotePressed: { backgroundColor: '#EAEFEE' },
  lineNoteText: { flex: 1, color: '#60706E', fontSize: 9, lineHeight: 13 },
  lineNoteTextFilled: { color: '#1F6174', fontWeight: '700' },
  empty: { flex: 1, minHeight: 220, padding: 26, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyIcon: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', borderRadius: 38, backgroundColor: '#FFE5E5' },
  emptyTitle: { color: '#172423', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  emptyText: { maxWidth: 330, color: '#60706E', fontSize: 10, lineHeight: 16, textAlign: 'center' },
  footer: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#D7E0DE', backgroundColor: '#FFFFFF' },
  supplyBanner: { marginBottom: 10, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#D9B98A', borderRadius: 9, backgroundColor: '#FBF1E1' },
  supplyBannerText: { flex: 1, color: '#8A5A32', fontSize: 10, fontWeight: '700' },
  footerActions: { marginTop: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  footerLabel: { color: '#60706E', fontSize: 9, fontWeight: '800' },
  footerHint: { marginTop: 2, color: '#60706E', fontSize: 8 },
  footerTotal: { color: '#B4232D', fontSize: 18, fontWeight: '900' },
  checkoutButton: { marginTop: 10 },
  checkoutButtonContent: { minHeight: 46 },
  cancelConfirmation: { marginTop: 7, padding: 9, borderRadius: 7, backgroundColor: '#FCE8EA' },
  cancelText: { color: '#8F1D2C', fontSize: 9, fontWeight: '700' },
  cancelActions: { marginTop: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  noteDialogTitle: { textAlign: 'center' },
  noteDialogHelp: { color: '#60706E', fontSize: 10, lineHeight: 15, textAlign: 'center' },
  noteInput: { marginTop: 12, minHeight: 110, backgroundColor: '#FFFFFF' },
  dock: { minHeight: 58, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#B4232D' },
  dockIcon: { position: 'relative', width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#1F6174' },
  dockCount: { position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#FF4D4D' },
  dockCountText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
  dockText: { flex: 1, minWidth: 0 },
  dockTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  dockSubtitle: { marginTop: 2, color: '#D5E7EC', fontSize: 8 },
  dockTotal: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
