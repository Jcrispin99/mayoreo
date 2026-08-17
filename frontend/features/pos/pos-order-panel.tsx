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
import {
  formatBaseQuantity,
  formatPosQuantity,
  isMeasuredProduct,
  pricingDisplay,
  resolveAmountToQuantity,
} from './pos-measurement';
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
  onRemoveItem: (order: PosOrder, item: PosOrderItem) => void;
  onReceiveSupply: (order: PosOrder, request: PosSupplyRequest) => void;
  onReloadWarehouseAssignees: () => void;
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
  warehouseAssigneesError: string;
  warehouseAssigneesLoading: boolean;
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
  const assignee = request.assignee?.name ?? 'el personal de almacén';

  switch (request.status) {
    case 'assigned':
      return `Pedido enviado a ${assignee}. Esperando que lo revise.`;
    case 'preparing':
      return `${assignee} está preparando el pedido (${supplyProgress(request)} productos).`;
    case 'changes_pending':
      return `Tus cambios fueron enviados a ${assignee}. Debe revisarlos antes de continuar.`;
    case 'ready':
      return `${assignee} terminó el pedido. Confirma cuando lo recibas.`;
    default:
      return 'Pedido en proceso.';
  }
}

function formatQuantity(value: string | number) {
  return new Intl.NumberFormat('es-PE', { maximumFractionDigits: 6 }).format(Number(value) || 0);
}

function decimalValue(value: string) {
  return Number(value.trim().replace(',', '.'));
}

function decrementedUnitQuantity(quantity: number) {
  const step = quantity > 1 ? 1 : 0.25;

  return Number(Math.max(0.01, quantity - step).toFixed(6));
}

function orderLineName(item: PosOrderItem) {
  return item.product.name;
}

function imageUrlForDevice(url: string) {
  if (Platform.OS !== 'android') return url;
  return url.replace(/https?:\/\/(localhost|127\.0\.0\.1)/, 'http://10.0.2.2');
}

function OrderLine({
  busy,
  item,
  onEditAmount,
  onEditWarehouseNotes,
  onRemove,
  onUpdateQuantity,
}: {
  busy: boolean;
  item: PosOrderItem;
  onEditAmount: () => void;
  onEditWarehouseNotes: () => void;
  onRemove: () => void;
  onUpdateQuantity: (quantity: number) => void;
}) {
  const measured = isMeasuredProduct(item.product);
  const priceDisplay = pricingDisplay(item.product.base_unit);
  const numericQuantity = Number(item.quantity);
  const displayedQuantity = measured ? numericQuantity / priceDisplay.factor : numericQuantity;
  const rawUnit = item.product.base_unit?.code ?? item.product.base_unit?.name ?? 'un.';
  const unit = measured
    ? priceDisplay.unit
    : rawUnit.trim().toLocaleLowerCase('es') === 'niu'
      ? 'un.'
      : rawUnit;
  const [quantity, setQuantity] = useState(formatQuantity(displayedQuantity));
  const displayedUnitPrice = Number(item.unit_price) * priceDisplay.factor;
  const displayName = orderLineName(item);

  useEffect(() => {
    setQuantity(formatQuantity(displayedQuantity));
  }, [displayedQuantity]);

  function updateDisplayedQuantity(nextQuantity: number) {
    onUpdateQuantity(measured ? nextQuantity * priceDisplay.factor : nextQuantity);
  }

  function commitQuantity() {
    const parsed = decimalValue(quantity);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setQuantity(formatQuantity(displayedQuantity));
      return;
    }
    const baseQuantity = measured ? parsed * priceDisplay.factor : parsed;
    if (Math.abs(baseQuantity - numericQuantity) > 0.000001) onUpdateQuantity(baseQuantity);
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
            <Text numberOfLines={2} style={styles.lineName}>{displayName}</Text>
            <Text style={styles.unitPrice}>
              {measured
                ? `${formatMoney(displayedUnitPrice)} / ${priceDisplay.unit}`
                : `${formatMoney(item.unit_price)} c/u`}
            </Text>
          </View>
          <View style={styles.lineActions}>
            <IconButton
              accessibilityLabel={`Editar nota para almacén de ${item.product.name}`}
              containerColor={item.warehouse_notes ? '#D5E7EC' : '#F1F4F3'}
              disabled={busy}
              icon={item.warehouse_notes ? 'note-text' : 'note-plus-outline'}
              iconColor={item.warehouse_notes ? '#1F6174' : '#60706E'}
              onPress={onEditWarehouseNotes}
              size={17}
              style={styles.lineActionButton}
            />
            <IconButton
              accessibilityLabel={`Retirar ${item.product.name}`}
              disabled={busy}
              icon="trash-can-outline"
              iconColor="#8F1D2C"
              onPress={onRemove}
              size={18}
              style={styles.lineActionButton}
            />
          </View>
        </View>

        <View style={styles.lineControlRow}>
          <View style={styles.quantityRow}>
            <IconButton
              accessibilityLabel={`Reducir cantidad de ${displayName}`}
              disabled={busy || displayedQuantity <= 0.01}
              icon="minus"
              mode="outlined"
              onPress={() => updateDisplayedQuantity(decrementedUnitQuantity(displayedQuantity))}
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
              accessibilityLabel={`Aumentar cantidad de ${displayName}`}
              disabled={busy}
              icon="plus"
              mode="outlined"
              onPress={() => updateDisplayedQuantity(displayedQuantity + 1)}
              size={16}
              style={styles.quantityButton}
            />
            <Text style={styles.unit}>{unit}</Text>
          </View>
          <Button
            accessibilityHint="Permite calcular una cantidad fraccionaria desde un monto"
            accessibilityLabel={`Editar monto de ${item.product.name}`}
            compact
            contentStyle={styles.lineTotalButtonContent}
            disabled={busy}
            icon="pencil-outline"
            labelStyle={styles.lineTotal}
            mode="text"
            onPress={onEditAmount}
            style={styles.lineTotalButton}
            textColor="#B4232D"
          >
            {formatMoney(item.line_total)}
          </Button>
        </View>
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
  onRemoveItem,
  onReceiveSupply,
  onReloadWarehouseAssignees,
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
  warehouseAssigneesError,
  warehouseAssigneesLoading,
}: PosOrderPanelProps) {
  const [cancelVisible, setCancelVisible] = useState(false);
  const [customerSelectorVisible, setCustomerSelectorVisible] = useState(false);
  const [assigneeSelectorVisible, setAssigneeSelectorVisible] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<number | null>(null);
  const [noteEditor, setNoteEditor] = useState<{ kind: 'order' } | { kind: 'item'; item: PosOrderItem } | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [amountItem, setAmountItem] = useState<PosOrderItem | null>(null);
  const [amountDraft, setAmountDraft] = useState('');
  const activeOrder = orders.find((order) => order.id === activeOrderId) ?? orders[0] ?? null;
  const numericAmount = decimalValue(amountDraft);
  const amountResolution = resolveAmountToQuantity(amountItem?.product ?? null, numericAmount);
  const amountDifference = amountResolution
    ? Math.abs(numericAmount - amountResolution.lineTotal)
    : 0;
  const pendingSupplyRequest = activeOrder?.supply_requests?.find(
    (request) => ACTIVE_SUPPLY_STATUSES.includes(request.status),
  ) ?? null;

  useEffect(() => {
    if (!visible) {
      setCancelVisible(false);
      setCustomerSelectorVisible(false);
      setAssigneeSelectorVisible(false);
      setSelectedAssigneeId(null);
      setNoteEditor(null);
      setAmountItem(null);
    }
  }, [visible]);

  useEffect(() => {
    setAssigneeSelectorVisible(false);
    setSelectedAssigneeId(null);
    setNoteEditor(null);
    setAmountItem(null);
  }, [activeOrderId]);

  function editOrderNotes() {
    setNoteDraft(activeOrder?.warehouse_notes ?? '');
    setNoteEditor({ kind: 'order' });
  }

  function editItemNotes(item: PosOrderItem) {
    setNoteDraft(item.warehouse_notes ?? '');
    setNoteEditor({ kind: 'item', item });
  }

  function editItemAmount(item: PosOrderItem) {
    setAmountDraft(Number(item.line_total).toFixed(2));
    setAmountItem(item);
  }

  function applyItemAmount() {
    if (!activeOrder || !amountItem || !amountResolution) return;

    const item = amountItem;
    const quantity = amountResolution.baseQuantity;
    setAmountItem(null);
    onUpdateQuantity(activeOrder, item, quantity);
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

  function openAssigneeSelector() {
    setSelectedAssigneeId(null);
    setAssigneeSelectorVisible(true);
  }

  function confirmSupplyRequest() {
    if (!activeOrder || selectedAssigneeId === null) return;

    setAssigneeSelectorVisible(false);
    onRequestSupply(activeOrder, selectedAssigneeId);
    setSelectedAssigneeId(null);
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
                    onEditAmount={() => editItemAmount(item)}
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
                  <View style={styles.footerSummaryInfo}>
                    <Text style={styles.footerLabel}>Total de la orden</Text>
                    <Button
                      compact
                      contentStyle={styles.footerAddProductContent}
                      disabled={busy || !sessionOpen}
                      icon="plus"
                      labelStyle={styles.footerAddProductLabel}
                      mode="text"
                      onPress={() => onAddProducts(activeOrder)}
                      style={styles.footerAddProduct}
                      textColor="#0F766E"
                    >
                      Agregar producto
                    </Button>
                    {activeOrder.items.length === 0 || pendingSupplyRequest ? (
                      <Text style={styles.footerHint}>
                        {activeOrder.items.length === 0
                          ? 'Agrega al menos un producto para cobrar.'
                          : 'No se puede cobrar hasta que llegue el stock pedido.'}
                      </Text>
                    ) : null}
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
                      contentStyle={styles.footerActionContent}
                      disabled={busy}
                      icon="close-circle-outline"
                      labelStyle={styles.footerActionLabel}
                      mode="text"
                      onPress={() => setCancelVisible(true)}
                      textColor="#8F1D2C"
                    >
                      Cancelar
                    </Button>
                    <View style={styles.warehouseFooterActions}>
                      {!pendingSupplyRequest && activeOrder.items.length > 0 ? (
                        <Button
                          compact
                          contentStyle={styles.footerActionContent}
                          disabled={busy || warehouseAssigneesLoading}
                          icon="truck-delivery-outline"
                          labelStyle={styles.footerActionLabel}
                          loading={warehouseAssigneesLoading}
                          mode="text"
                          onPress={openAssigneeSelector}
                          textColor="#1F6174"
                        >
                          {warehouseAssigneesLoading ? 'Cargando' : 'Pedir almacén'}
                        </Button>
                      ) : null}
                      <Button
                        compact
                        contentStyle={styles.footerActionContent}
                        disabled={busy}
                        icon={activeOrder.warehouse_notes ? 'note-text' : 'note-plus-outline'}
                        labelStyle={styles.footerActionLabel}
                        mode="text"
                        onPress={editOrderNotes}
                        textColor="#1F6174"
                      >
                        Notas generales
                      </Button>
                    </View>
                  </View>
                )}
              </View>

              <PosCustomerSelector
                onClose={() => setCustomerSelectorVisible(false)}
                onSelect={(customer) => onUpdateCustomer(activeOrder, customer)}
                selectedCustomer={activeOrder.customer}
                visible={customerSelectorVisible}
              />
            </>
          )}
        </KeyboardAvoidingView>

        {amountItem ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.overlay, styles.amountModal]}
          >
            <Pressable
              accessibilityLabel="Cerrar editor de monto"
              accessibilityRole="button"
              disabled={busy}
              onPress={() => setAmountItem(null)}
              style={styles.amountBackdrop}
            />
            <View style={styles.amountCard}>
              <View style={styles.amountHeading}>
                <View style={styles.amountHeadingCopy}>
                  <Text style={styles.amountEyebrow}>Monto de esta línea</Text>
                  <Text numberOfLines={2} style={styles.amountProduct}>{amountItem.product.name}</Text>
                </View>
                <IconButton
                  accessibilityLabel="Cerrar editor de monto"
                  disabled={busy}
                  icon="close"
                  onPress={() => setAmountItem(null)}
                  style={styles.amountClose}
                />
              </View>

              <TextInput
                autoFocus
                dense
                disabled={busy}
                keyboardType="decimal-pad"
                label="Monto deseado"
                left={<TextInput.Affix text="S/" />}
                mode="outlined"
                onChangeText={setAmountDraft}
                onSubmitEditing={applyItemAmount}
                outlineColor="#C9D5D2"
                selectTextOnFocus
                style={styles.amountInput}
                value={amountDraft}
              />

              {amountDraft.trim() !== '' && !amountResolution ? (
                <Text style={styles.amountError}>No existe un precio aplicable para ese monto.</Text>
              ) : amountResolution ? (
                <View style={styles.amountResult}>
                  <Text style={styles.amountResultLabel}>Nueva cantidad</Text>
                  <Text style={styles.amountResultValue}>
                    {isMeasuredProduct(amountItem.product)
                      ? formatBaseQuantity(amountResolution.baseQuantity, amountItem.product.base_unit)
                      : `${formatPosQuantity(amountResolution.baseQuantity, 6)} ${amountItem.product.base_unit?.code ?? 'un.'}`}
                  </Text>
                  {amountDifference >= 0.01 ? (
                    <Text style={styles.amountDifference}>
                      Total aplicable: {formatMoney(amountResolution.lineTotal)}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.amountActions}>
                <Button disabled={busy} onPress={() => setAmountItem(null)} textColor="#60706E">
                  Cancelar
                </Button>
                <Button
                  disabled={!amountResolution || busy}
                  mode="contained"
                  onPress={applyItemAmount}
                >
                  Aplicar monto
                </Button>
              </View>
            </View>
          </KeyboardAvoidingView>
        ) : null}

        {assigneeSelectorVisible && activeOrder ? (
          <View style={styles.overlay}>
            <Pressable
              accessibilityLabel="Cerrar selección de almacenero"
              accessibilityRole="button"
              onPress={() => setAssigneeSelectorVisible(false)}
              style={styles.overlayBackdrop}
            />
            <View style={styles.assigneeSheet}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <View style={styles.sheetIcon}>
                  <Icon color="#1F6174" size={25} source="account-hard-hat-outline" />
                </View>
                <View style={styles.sheetHeaderCopy}>
                  <Text style={styles.sheetTitle}>Pedir al almacén</Text>
                  <Text style={styles.sheetSubtitle}>
                    Selecciona quién preparará la orden {activeOrder.number}.
                  </Text>
                </View>
                <IconButton
                  accessibilityLabel="Cerrar selección de almacenero"
                  icon="close"
                  onPress={() => setAssigneeSelectorVisible(false)}
                  size={20}
                  style={styles.sheetClose}
                />
              </View>

              {warehouseAssigneesLoading ? (
                <View style={styles.assigneeState}>
                  <ActivityIndicator color="#1F6174" size="large" />
                  <Text style={styles.assigneeStateTitle}>Cargando personal de almacén</Text>
                  <Text style={styles.assigneeStateText}>Espera un momento mientras actualizamos la lista.</Text>
                </View>
              ) : warehouseAssigneesError ? (
                <View style={styles.assigneeState}>
                  <Icon color="#8F1D2C" size={28} source="alert-circle-outline" />
                  <Text style={styles.assigneeStateTitle}>No se pudo cargar el personal</Text>
                  <Text style={styles.assigneeStateText}>{warehouseAssigneesError}</Text>
                  <Button icon="refresh" mode="outlined" onPress={onReloadWarehouseAssignees}>
                    Reintentar
                  </Button>
                </View>
              ) : warehouseAssignees.length === 0 ? (
                <View style={styles.assigneeState}>
                  <Icon color="#60706E" size={30} source="account-off-outline" />
                  <Text style={styles.assigneeStateTitle}>No hay almaceneros disponibles</Text>
                  <Text style={styles.assigneeStateText}>
                    Registra un usuario con el rol de almacén para poder asignarle esta orden.
                  </Text>
                  <Button icon="refresh" mode="text" onPress={onReloadWarehouseAssignees}>
                    Actualizar lista
                  </Button>
                </View>
              ) : (
                <ScrollView
                  contentContainerStyle={styles.assigneeListContent}
                  showsVerticalScrollIndicator={false}
                  style={styles.assigneeList}
                >
                  {warehouseAssignees.map((assignee) => {
                    const selected = selectedAssigneeId === assignee.id;

                    return (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        key={assignee.id}
                        onPress={() => setSelectedAssigneeId(assignee.id)}
                        style={({ pressed }) => [
                          styles.assigneeOption,
                          selected && styles.assigneeOptionSelected,
                          pressed && styles.assigneeOptionPressed,
                        ]}
                      >
                        <View style={[styles.assigneeAvatar, selected && styles.assigneeAvatarSelected]}>
                          <Icon color={selected ? '#FFFFFF' : '#1F6174'} size={21} source="account-outline" />
                        </View>
                        <View style={styles.assigneeCopy}>
                          <Text style={styles.assigneeName}>{assignee.name}</Text>
                          <Text style={styles.assigneeRole}>Personal de almacén</Text>
                        </View>
                        <Icon
                          color={selected ? '#1F6174' : '#A0ADAA'}
                          size={22}
                          source={selected ? 'check-circle' : 'circle-outline'}
                        />
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              {!warehouseAssigneesLoading && !warehouseAssigneesError && warehouseAssignees.length > 0 ? (
                <View style={styles.sheetActions}>
                  <Button disabled={busy} onPress={() => setAssigneeSelectorVisible(false)}>
                    Cancelar
                  </Button>
                  <Button
                    buttonColor="#1F6174"
                    disabled={busy || selectedAssigneeId === null}
                    icon="send-outline"
                    mode="contained"
                    onPress={confirmSupplyRequest}
                  >
                    Enviar pedido
                  </Button>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {noteEditor ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.overlay, styles.noteOverlay]}
          >
            <Pressable
              accessibilityLabel="Cerrar editor de indicaciones"
              accessibilityRole="button"
              disabled={noteSaving}
              onPress={() => setNoteEditor(null)}
              style={styles.overlayBackdrop}
            />
            <View style={styles.noteCard}>
              <View style={styles.noteCardIcon}>
                <Icon
                  color="#1F6174"
                  size={27}
                  source={noteEditor.kind === 'order' ? 'text-box-edit-outline' : 'note-edit-outline'}
                />
              </View>
              <Text style={styles.noteDialogTitle}>
                {noteEditor.kind === 'order'
                  ? 'Indicaciones del pedido'
                  : `Indicación de ${noteEditor.item.product.name}`}
              </Text>
              <Text style={styles.noteDialogHelp}>
                Esta información será visible para la persona de almacén asignada.
              </Text>
              <TextInput
                autoFocus
                disabled={noteSaving}
                label="Indicación para almacén"
                maxLength={noteEditor.kind === 'order' ? 1000 : 500}
                mode="outlined"
                multiline
                numberOfLines={4}
                onChangeText={setNoteDraft}
                style={styles.noteInput}
                value={noteDraft}
              />
              <View style={styles.noteActions}>
                <Button disabled={noteSaving} onPress={() => setNoteEditor(null)}>Cancelar</Button>
                <Button
                  buttonColor="#1F6174"
                  icon="content-save-outline"
                  loading={noteSaving}
                  mode="contained"
                  onPress={() => void saveNotes()}
                >
                  Guardar
                </Button>
              </View>
            </View>
          </KeyboardAvoidingView>
        ) : null}
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
  lineActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  lineActionButton: { width: 30, height: 30, margin: 0 },
  lineControlRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  quantityRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  quantityButton: { width: 28, height: 28, margin: 0 },
  quantityInput: { width: 64, height: 32, backgroundColor: '#FFFFFF', fontSize: 11, textAlign: 'center' },
  unit: { maxWidth: 55, color: '#60706E', fontSize: 9, fontWeight: '700' },
  unitPrice: { marginTop: 2, color: '#60706E', fontSize: 9 },
  lineTotal: { marginHorizontal: 3, marginVertical: 0, fontSize: 15, lineHeight: 20, fontWeight: '900' },
  lineTotalButton: { flexShrink: 0, height: 34, margin: 0, borderRadius: 7 },
  lineTotalButtonContent: { height: 34, flexDirection: 'row-reverse' },
  amountModal: { flex: 1, padding: 18, justifyContent: 'center' },
  amountBackdrop: { position: 'absolute', inset: 0, backgroundColor: 'rgba(23, 36, 35, 0.55)' },
  amountCard: { padding: 16, gap: 13, borderRadius: 18, backgroundColor: '#FFFFFF' },
  amountHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  amountHeadingCopy: { flex: 1, minWidth: 0 },
  amountEyebrow: { color: '#60706E', fontSize: 10, fontWeight: '800' },
  amountProduct: { marginTop: 2, color: '#172423', fontSize: 16, lineHeight: 21, fontWeight: '900' },
  amountClose: { margin: 0, backgroundColor: '#EAEFEE' },
  amountInput: { backgroundColor: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  amountError: { color: '#8F1D2C', fontSize: 10, fontWeight: '700' },
  amountResult: { padding: 11, borderRadius: 10, backgroundColor: '#E7F7F3' },
  amountResultLabel: { color: '#60706E', fontSize: 9, fontWeight: '800' },
  amountResultValue: { marginTop: 2, color: '#0F766E', fontSize: 16, fontWeight: '900' },
  amountDifference: { marginTop: 3, color: '#8A5A32', fontSize: 9, fontWeight: '700' },
  amountActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  empty: { flex: 1, minHeight: 220, padding: 26, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyIcon: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', borderRadius: 38, backgroundColor: '#FFE5E5' },
  emptyTitle: { color: '#172423', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  emptyText: { maxWidth: 330, color: '#60706E', fontSize: 10, lineHeight: 16, textAlign: 'center' },
  footer: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#D7E0DE', backgroundColor: '#FFFFFF' },
  supplyBanner: { marginBottom: 10, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#D9B98A', borderRadius: 9, backgroundColor: '#FBF1E1' },
  supplyBannerText: { flex: 1, color: '#8A5A32', fontSize: 10, fontWeight: '700' },
  footerActions: { marginTop: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 2 },
  warehouseFooterActions: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 1 },
  footerActionContent: { minHeight: 34, paddingHorizontal: 2 },
  footerActionLabel: { marginHorizontal: 2, fontSize: 8.5, fontWeight: '800' },
  footerHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  footerSummaryInfo: { flex: 1, minWidth: 0 },
  footerLabel: { color: '#60706E', fontSize: 9, fontWeight: '800' },
  footerAddProduct: { alignSelf: 'flex-start', minWidth: 0, marginLeft: -9, marginVertical: -3 },
  footerAddProductContent: { minHeight: 28 },
  footerAddProductLabel: { marginHorizontal: 2, fontSize: 10, fontWeight: '900' },
  footerHint: { marginTop: 1, color: '#60706E', fontSize: 8 },
  footerTotal: { color: '#B4232D', fontSize: 18, fontWeight: '900' },
  checkoutButton: { marginTop: 10 },
  checkoutButtonContent: { minHeight: 46 },
  cancelConfirmation: { marginTop: 7, padding: 9, borderRadius: 7, backgroundColor: '#FCE8EA' },
  cancelText: { color: '#8F1D2C', fontSize: 9, fontWeight: '700' },
  cancelActions: { marginTop: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  overlay: { position: 'absolute', inset: 0, zIndex: 100, elevation: 100, justifyContent: 'flex-end' },
  overlayBackdrop: { position: 'absolute', inset: 0, backgroundColor: 'rgba(23, 36, 35, 0.52)' },
  assigneeSheet: { maxHeight: '78%', paddingTop: 7, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: '#FFFFFF' },
  sheetHandle: { width: 50, height: 5, marginBottom: 10, alignSelf: 'center', borderRadius: 3, backgroundColor: '#CCD7D4' },
  sheetHeader: { paddingHorizontal: 16, paddingBottom: 13, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: '#E2E8E6' },
  sheetIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#D5E7EC' },
  sheetHeaderCopy: { flex: 1, minWidth: 0 },
  sheetTitle: { color: '#172423', fontSize: 16, fontWeight: '900' },
  sheetSubtitle: { marginTop: 2, color: '#60706E', fontSize: 10, lineHeight: 14 },
  sheetClose: { margin: 0, backgroundColor: '#EAEFEE' },
  assigneeList: { maxHeight: 330 },
  assigneeListContent: { padding: 14, gap: 8 },
  assigneeOption: { minHeight: 62, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 11, backgroundColor: '#FFFFFF' },
  assigneeOptionSelected: { borderWidth: 2, borderColor: '#1F6174', backgroundColor: '#EDF7FA' },
  assigneeOptionPressed: { backgroundColor: '#E5F1F4' },
  assigneeAvatar: { width: 39, height: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#D5E7EC' },
  assigneeAvatarSelected: { backgroundColor: '#1F6174' },
  assigneeCopy: { flex: 1, minWidth: 0 },
  assigneeName: { color: '#172423', fontSize: 12, fontWeight: '900' },
  assigneeRole: { marginTop: 2, color: '#60706E', fontSize: 9 },
  assigneeState: { minHeight: 210, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 9 },
  assigneeStateTitle: { color: '#172423', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  assigneeStateText: { maxWidth: 330, color: '#60706E', fontSize: 10, lineHeight: 15, textAlign: 'center' },
  sheetActions: { paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, borderTopWidth: 1, borderTopColor: '#E2E8E6' },
  noteOverlay: { paddingHorizontal: 16, justifyContent: 'center' },
  noteCard: { padding: 18, borderRadius: 18, backgroundColor: '#FFFFFF' },
  noteCardIcon: { width: 50, height: 50, marginBottom: 10, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#D5E7EC' },
  noteDialogTitle: { color: '#172423', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  noteDialogHelp: { color: '#60706E', fontSize: 10, lineHeight: 15, textAlign: 'center' },
  noteInput: { marginTop: 12, minHeight: 110, backgroundColor: '#FFFFFF' },
  noteActions: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 7 },
  dock: { minHeight: 58, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#B4232D' },
  dockIcon: { position: 'relative', width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#1F6174' },
  dockCount: { position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#FF4D4D' },
  dockCountText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
  dockText: { flex: 1, minWidth: 0 },
  dockTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  dockSubtitle: { marginTop: 2, color: '#D5E7EC', fontSize: 8 },
  dockTotal: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
