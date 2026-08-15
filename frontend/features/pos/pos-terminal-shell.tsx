import axios from 'axios';
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Dialog, Divider, Icon, IconButton, Menu, Portal, Snackbar, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { PosBarcodeScanner } from './pos-barcode-scanner';
import { PosCheckoutModal } from './pos-checkout-modal';
import type { PosSaleUnitCode } from './pos-measurement';
import { PosOrderDock, PosOrderPanel } from './pos-order-panel';
import { PosProductCatalog } from './pos-product-catalog';
import type {
  CashRegisterSession,
  PosCatalogProduct,
  PosCheckoutPayload,
  PosCheckoutResult,
  PosOrder,
  PosOrderItem,
} from './pos-types';
import type { Customer } from '../customers/customer-types';
import type { PosSupplyRequest, PosSupplyRequestStatus, WarehouseAssignee } from '../inventory/inventory-types';

type OrderNotice = {
  message: string;
  error: boolean;
  surface?: 'catalog' | 'order';
};

type OrderOverlay =
  | { kind: 'closed' }
  | { kind: 'orders' }
  | { kind: 'checkout'; orderId: number };

type CheckoutConflictResponse = {
  data?: {
    order?: PosOrder;
  };
  message?: string;
};

function requestErrorMessage(requestError: any, fallback: string) {
  const validationErrors = requestError?.response?.data?.errors;
  const firstValidationError = validationErrors ? Object.values(validationErrors).flat()[0] : null;

  return typeof firstValidationError === 'string'
    ? firstValidationError
    : requestError?.response?.data?.message ?? fallback;
}

const ACTIVE_SUPPLY_STATUSES: PosSupplyRequestStatus[] = [
  'assigned',
  'preparing',
  'changes_pending',
  'ready',
];

export function PosTerminalShell({ cashSessionId }: { cashSessionId: string }) {
  const [session, setSession] = useState<CashRegisterSession | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [closeDialogVisible, setCloseDialogVisible] = useState(false);
  const [countedAmount, setCountedAmount] = useState('');
  const [closing, setClosing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [closeError, setCloseError] = useState('');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [activeCatalogFilterIds, setActiveCatalogFilterIds] = useState<string[]>([]);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [orderOverlay, setOrderOverlay] = useState<OrderOverlay>({ kind: 'closed' });
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderBusy, setOrderBusy] = useState(false);
  const [addingProductId, setAddingProductId] = useState<number | null>(null);
  const [orderNotice, setOrderNotice] = useState<OrderNotice | null>(null);
  const [warehouseAssignees, setWarehouseAssignees] = useState<WarehouseAssignee[]>([]);
  const [warehouseAssigneesError, setWarehouseAssigneesError] = useState('');
  const [warehouseAssigneesLoading, setWarehouseAssigneesLoading] = useState(false);
  const orderMutation = useRef(false);

  const loadSession = useCallback(async (initialLoad = false): Promise<CashRegisterSession | null> => {
    if (initialLoad) {
      setLoading(true);
      setError('');
    }

    try {
      const response = await api.get(`/cash-register-sessions/${cashSessionId}`);
      const loadedSession = response.data.data as CashRegisterSession;
      setSession(loadedSession);
      return loadedSession;
    } catch {
      if (initialLoad) setError('No se pudo cargar la caja abierta.');
      return null;
    } finally {
      if (initialLoad) setLoading(false);
    }
  }, [cashSessionId]);

  useEffect(() => {
    void loadSession(true);
  }, [loadSession]);

  useEffect(() => {
    if (!session || session.status !== 'open') return;

    const controller = new AbortController();
    const sessionId = session.id;
    setOrdersLoading(true);

    async function loadOrders() {
      try {
        const response = await api.get(`/cash-register-sessions/${sessionId}/orders`, {
          signal: controller.signal,
        });
        const loadedOrders = (response.data.data ?? []) as PosOrder[];
        if (controller.signal.aborted) return;
        setOrders(loadedOrders);
        setActiveOrderId((current) => (
          loadedOrders.some((order) => order.id === current)
            ? current
            : loadedOrders.at(-1)?.id ?? null
        ));
      } catch (requestError: any) {
        if (controller.signal.aborted) return;
        setOrderNotice({
          message: requestErrorMessage(requestError, 'No se pudieron cargar las órdenes abiertas.'),
          error: true,
        });
      } finally {
        if (!controller.signal.aborted) setOrdersLoading(false);
      }
    }

    void loadOrders();

    return () => controller.abort();
  }, [session]);

  const loadWarehouseAssignees = useCallback(async () => {
    setWarehouseAssigneesLoading(true);
    setWarehouseAssigneesError('');

    try {
      const response = await api.get('/pos/supply-assignees');
      setWarehouseAssignees((response.data.data ?? []) as WarehouseAssignee[]);
    } catch (requestError: any) {
      setWarehouseAssignees([]);
      setWarehouseAssigneesError(
        requestErrorMessage(requestError, 'No se pudo cargar el personal de almacén.'),
      );
    } finally {
      setWarehouseAssigneesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session || session.status !== 'open') {
      setWarehouseAssignees([]);
      setWarehouseAssigneesError('');
      return;
    }

    void loadWarehouseAssignees();
  }, [loadWarehouseAssignees, session?.id, session?.status]);

  // Mientras una orden tenga una comanda pendiente (esperando al almacén),
  // se hace polling periódico de esa orden hasta que quede resuelta.
  const pendingSupplyOrderIds = useMemo(
    () => orders
      .filter((order) => order.supply_requests?.some((request) => ACTIVE_SUPPLY_STATUSES.includes(request.status)))
      .map((order) => order.id)
      .join(','),
    [orders],
  );

  useEffect(() => {
    if (!session || pendingSupplyOrderIds === '') return;

    const orderIds = pendingSupplyOrderIds.split(',').map(Number);
    const interval = setInterval(() => {
      orderIds.forEach((orderId) => { void reloadOrder(orderId); });
    }, 4000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSupplyOrderIds, session]);

  const activeOrder = useMemo(
    () => orders.find((order) => order.id === activeOrderId) ?? orders.at(-1) ?? null,
    [activeOrderId, orders],
  );
  const checkoutOrder = useMemo(
    () => orderOverlay.kind === 'checkout'
      ? orders.find((order) => order.id === orderOverlay.orderId) ?? null
      : null,
    [orderOverlay, orders],
  );
  const activeOrderQuantities = useMemo(
    () => Object.fromEntries(
      (activeOrder?.items ?? []).map((item) => [item.product_id, Number(item.quantity) || 0]),
    ),
    [activeOrder],
  );

  function leavePos() {
    setMenuVisible(false);
    router.replace({
      pathname: '/module/[moduleId]/[itemId]',
      params: { moduleId: 'pos', itemId: 'cash-registers' },
    } as Href);
  }

  function openOrders() {
    setOrderNotice((current) => (
      current?.surface === 'catalog' && !current.error ? null : current
    ));
    setOrderOverlay({ kind: 'orders' });
  }

  function openCloseDialog() {
    setMenuVisible(false);
    setCountedAmount('');
    setCloseError('');
    setCloseDialogVisible(true);
  }

  async function closeCashRegister() {
    if (!session) return;
    if (!countedAmount.trim() || Number(countedAmount) < 0) {
      setCloseError('Ingresa un monto de cierre válido.');
      return;
    }

    setClosing(true);
    setCloseError('');
    try {
      await api.post(`/cash-register-sessions/${session.id}/close`, {
        counted_amount: Number(countedAmount),
      });
      setCloseDialogVisible(false);
      leavePos();
    } catch (requestError: any) {
      setCloseError(requestErrorMessage(requestError, 'No se pudo cerrar la caja.'));
    } finally {
      setClosing(false);
    }
  }

  function toggleCatalogFilter(filterId: string) {
    setActiveCatalogFilterIds((current) => current.includes(filterId)
      ? current.filter((currentId) => currentId !== filterId)
      : [...current, filterId]);
  }

  function handleBarcodeScanned(barcode: string) {
    setCatalogQuery(barcode);
    setSearchExpanded(true);
  }

  function replaceOrder(updatedOrder: PosOrder) {
    setOrders((current) => {
      const exists = current.some((order) => order.id === updatedOrder.id);
      return exists
        ? current.map((order) => order.id === updatedOrder.id ? updatedOrder : order)
        : [...current, updatedOrder];
    });
  }

  async function runOrderMutation<T>(operation: () => Promise<T>): Promise<T | null> {
    if (orderMutation.current) return null;

    orderMutation.current = true;
    setOrderBusy(true);
    try {
      return await operation();
    } catch (requestError: any) {
      setOrderNotice({
        message: requestErrorMessage(requestError, 'No se pudo actualizar la orden.'),
        error: true,
      });
      return null;
    } finally {
      orderMutation.current = false;
      setOrderBusy(false);
    }
  }

  async function reloadOrder(orderId: number): Promise<PosOrder | null> {
    if (!session) return null;

    try {
      const response = await api.get(`/cash-register-sessions/${session.id}/orders/${orderId}`);
      const order = response.data.data as PosOrder;
      replaceOrder(order);
      return order;
    } catch {
      return null;
    }
  }

  async function requestSupply(order: PosOrder, assignedTo: number) {
    if (!session) return;

    const updatedOrder = await runOrderMutation(async () => {
      await api.post(
        `/cash-register-sessions/${session.id}/orders/${order.id}/supply-requests`,
        { assigned_to: assignedTo },
      );
      return reloadOrder(order.id);
    });

    if (updatedOrder) {
      setOrderNotice({
        message: `Comanda enviada al almacén para la orden ${order.number}.`,
        error: false,
      });
    }
  }

  async function receiveSupply(order: PosOrder, request: PosSupplyRequest) {
    if (!session) return;

    const updatedOrder = await runOrderMutation(async () => {
      await api.post(
        `/cash-register-sessions/${session.id}/orders/${order.id}/supply-requests/${request.id}/receive`,
        { expected_version: request.version },
      );
      return reloadOrder(order.id);
    });

    if (updatedOrder) {
      setOrderNotice({
        message: `Pedido de la orden ${order.number} recibido. Ya puedes cobrar.`,
        error: false,
      });
    }
  }

  async function requestNewOrder(): Promise<PosOrder> {
    if (!session) throw new Error('No hay una apertura de caja disponible.');

    const response = await api.post(`/cash-register-sessions/${session.id}/orders`);
    const order = response.data.data as PosOrder;
    replaceOrder(order);
    setActiveOrderId(order.id);

    return order;
  }

  async function createOrder() {
    const order = await runOrderMutation(requestNewOrder);
    if (!order) return;
    setOrderOverlay({ kind: 'orders' });
    setOrderNotice({ message: `Orden ${order.number} creada.`, error: false });
  }

  // Fija la orden destino de forma explícita antes de volver al catálogo, para que
  // los productos tocados no caigan en la orden que quedó activa por accidente.
  function startAddingProducts(order: PosOrder) {
    setActiveOrderId(order.id);
    setOrderNotice({
      message: `Agregando productos a la orden ${order.number}.`,
      error: false,
      surface: 'catalog',
    });
    setOrderOverlay({ kind: 'closed' });
  }

  async function addConfiguredProduct(
    product: PosCatalogProduct,
    quantity: number,
    unitCode: PosSaleUnitCode,
  ): Promise<boolean> {
    if (!session || orderMutation.current) return false;

    setAddingProductId(product.id);
    const updatedOrder = await runOrderMutation(async () => {
      const order = activeOrder ?? await requestNewOrder();
      const response = await api.post(
        `/cash-register-sessions/${session.id}/orders/${order.id}/items`,
        { product_id: product.id, quantity, unit_code: unitCode },
      );

      return response.data.data as PosOrder;
    });
    setAddingProductId(null);

    if (!updatedOrder) return false;
    replaceOrder(updatedOrder);
    setOrderNotice({
      message: `${product.name} agregado a la orden.`,
      error: false,
      surface: 'catalog',
    });

    return true;
  }

  async function updateOrderQuantity(order: PosOrder, item: PosOrderItem, quantity: number) {
    if (!session) return;

    const updatedOrder = await runOrderMutation(async () => {
      const response = await api.patch(
        `/cash-register-sessions/${session.id}/orders/${order.id}/items/${item.id}`,
        { quantity },
      );
      return response.data.data as PosOrder;
    });

    if (updatedOrder) replaceOrder(updatedOrder);
  }

  async function updateOrderCustomer(order: PosOrder, customer: Customer | null): Promise<boolean> {
    if (!session) return false;

    const updatedOrder = await runOrderMutation(async () => {
      const response = await api.patch(
        `/cash-register-sessions/${session.id}/orders/${order.id}/customer`,
        { customer_id: customer?.id ?? null },
      );
      return response.data.data as PosOrder;
    });

    if (!updatedOrder) return false;

    replaceOrder(updatedOrder);
    setOrderNotice(null);
    return true;
  }

  async function updateOrderWarehouseNotes(order: PosOrder, warehouseNotes: string): Promise<boolean> {
    if (!session) return false;

    const updatedOrder = await runOrderMutation(async () => {
      const response = await api.patch(
        `/cash-register-sessions/${session.id}/orders/${order.id}/warehouse-notes`,
        { warehouse_notes: warehouseNotes.trim() || null },
      );
      return response.data.data as PosOrder;
    });

    if (!updatedOrder) return false;
    replaceOrder(updatedOrder);
    setOrderNotice({ message: 'Indicaciones generales actualizadas.', error: false });
    return true;
  }

  async function updateItemWarehouseNotes(
    order: PosOrder,
    item: PosOrderItem,
    warehouseNotes: string,
  ): Promise<boolean> {
    if (!session) return false;

    const updatedOrder = await runOrderMutation(async () => {
      const response = await api.patch(
        `/cash-register-sessions/${session.id}/orders/${order.id}/items/${item.id}`,
        {
          quantity: item.quantity,
          warehouse_notes: warehouseNotes.trim() || null,
        },
      );
      return response.data.data as PosOrder;
    });

    if (!updatedOrder) return false;
    replaceOrder(updatedOrder);
    setOrderNotice({ message: `Indicación de ${item.product.name} actualizada.`, error: false });
    return true;
  }

  async function removeOrderItem(order: PosOrder, item: PosOrderItem) {
    if (!session) return;

    const updatedOrder = await runOrderMutation(async () => {
      const response = await api.delete(
        `/cash-register-sessions/${session.id}/orders/${order.id}/items/${item.id}`,
      );
      return response.data.data as PosOrder;
    });

    if (!updatedOrder) return;
    replaceOrder(updatedOrder);
    setOrderNotice({ message: `${item.product.name} retirado de la orden.`, error: false });
  }

  async function cancelOrder(order: PosOrder) {
    if (!session) return;

    const cancelled = await runOrderMutation(async () => {
      const response = await api.patch(
        `/cash-register-sessions/${session.id}/orders/${order.id}/cancel`,
      );
      return response.data.data as PosOrder;
    });

    if (!cancelled) return;
    setOrders((current) => {
      const remaining = current.filter((currentOrder) => currentOrder.id !== cancelled.id);
      setActiveOrderId(remaining.at(-1)?.id ?? null);
      return remaining;
    });
    setOrderNotice({ message: `Orden ${order.number} cancelada.`, error: false });
  }

  function openCheckout(order: PosOrder) {
    if (
      orderBusy
      || ordersLoading
      || order.items.length === 0
      || session?.status !== 'open'
    ) return;

    setActiveOrderId(order.id);
    setOrderNotice(null);
    setOrderOverlay({ kind: 'checkout', orderId: order.id });
  }

  function returnToOrder() {
    if (!checkoutOrder || session?.status !== 'open') {
      setOrderOverlay({ kind: 'closed' });
      return;
    }

    setActiveOrderId(checkoutOrder.id);
    setOrderOverlay({ kind: 'orders' });
  }

  async function submitCheckout(payload: PosCheckoutPayload): Promise<PosCheckoutResult | null> {
    if (!session || session.status !== 'open' || !checkoutOrder) {
      throw new Error('No hay una orden abierta disponible para cobrar.');
    }

    try {
      const response = await api.post(
        `/cash-register-sessions/${session.id}/orders/${checkoutOrder.id}/checkout`,
        payload,
        { timeout: 20_000 },
      );

      return response.data.data as PosCheckoutResult;
    } catch (requestError: unknown) {
      if (
        axios.isAxiosError<CheckoutConflictResponse>(requestError)
        && requestError.response?.status === 409
      ) {
        const conflictOrder = requestError.response.data?.data?.order;

        if (
          conflictOrder
          && conflictOrder.id === checkoutOrder.id
          && Array.isArray(conflictOrder.items)
        ) {
          replaceOrder(conflictOrder);
          setOrderNotice({
            message: requestError.response.data?.message
              ?? 'El total cambió. Revisa la orden antes de cobrar nuevamente.',
            error: true,
          });
          setOrderOverlay({ kind: 'orders' });
          return null;
        }
      }

      throw requestError;
    }
  }

  async function finishCheckout(result: PosCheckoutResult) {
    const remainingOrders = orders.filter((order) => order.id !== result.order.id);
    setOrders(remainingOrders);
    setActiveOrderId((current) => (
      current !== result.order.id && remainingOrders.some((order) => order.id === current)
        ? current
        : remainingOrders.at(-1)?.id ?? null
    ));
    setOrderOverlay({ kind: 'closed' });

    const refreshedSession = await loadSession();
    if (!refreshedSession) {
      setOrderNotice({
        message: 'La venta se completó, pero no se pudo actualizar el efectivo esperado de la caja.',
        error: true,
      });
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <ActivityIndicator color="#B4232D" size="large" style={styles.loader} />
      </SafeAreaView>
    );
  }

  const catalogAvailable = !error && session?.status === 'open';

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.identity}>
          <View style={styles.icon}><Icon color="#B4232D" size={22} source="point-of-sale" /></View>
          <View style={styles.identityText}>
            <Text numberOfLines={1} style={styles.title}>POS móvil</Text>
            <Text numberOfLines={1} style={styles.cashRegister}>
              {session ? `${session.cash_register.code} · ${session.cash_register.name}` : 'Caja no disponible'}
            </Text>
          </View>
        </View>
        <View style={styles.topActions}>
          {catalogAvailable && !searchExpanded ? (
            <View style={styles.searchAction}>
              <IconButton
                accessibilityLabel="Buscar productos"
                icon="magnify"
                iconColor="#172423"
                mode="contained-tonal"
                onPress={() => setSearchExpanded(true)}
                size={21}
                style={styles.actionButton}
              />
              {activeCatalogFilterIds.length > 0 ? (
                <View pointerEvents="none" style={styles.activeFilterCount}>
                  <Text style={styles.activeFilterCountText}>{activeCatalogFilterIds.length}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {catalogAvailable ? (
            <IconButton
              accessibilityLabel="Escanear código de barras"
              icon="barcode-scan"
              iconColor="#172423"
              mode="contained-tonal"
              onPress={() => setScannerVisible(true)}
              size={21}
              style={styles.actionButton}
            />
          ) : null}
          <Menu
            anchor={(
              <IconButton
                accessibilityLabel="Abrir menú del POS"
                icon="menu"
                iconColor="#172423"
                mode="contained-tonal"
                onPress={() => setMenuVisible(true)}
                size={24}
                style={styles.menuButton}
              />
            )}
            anchorPosition="bottom"
            onDismiss={() => setMenuVisible(false)}
            visible={menuVisible}
          >
            <Menu.Item
              disabled={!catalogAvailable}
              leadingIcon="receipt-text-outline"
              onPress={() => {
                setMenuVisible(false);
                openOrders();
              }}
              title={`Órdenes (${orders.length})`}
            />
            <Divider />
            <Menu.Item
              disabled={!session || session.status !== 'open'}
              leadingIcon="lock-outline"
              onPress={openCloseDialog}
              title="Cerrar caja"
            />
            <Divider />
            <Menu.Item leadingIcon="exit-to-app" onPress={leavePos} title="Salir" />
          </Menu>
        </View>
      </View>

      {error ? (
        <View style={styles.workspace}>
          <Icon color="#8F1D2C" size={38} source="alert-circle-outline" />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : session?.status === 'open' ? (
        <PosProductCatalog
          activeFilterIds={activeCatalogFilterIds}
          activeOrderQuantities={activeOrderQuantities}
          addingProductId={addingProductId}
          cashSessionId={cashSessionId}
          onAddProduct={addConfiguredProduct}
          onQueryChange={setCatalogQuery}
          onSearchExpandedChange={setSearchExpanded}
          onToggleFilter={toggleCatalogFilter}
          orderBusy={orderBusy || ordersLoading}
          query={catalogQuery}
          searchExpanded={searchExpanded}
        />
      ) : (
        <View style={styles.workspace}>
          <Icon color="#8F1D2C" size={38} source="lock-outline" />
          <Text style={styles.error}>Esta apertura de caja ya está cerrada.</Text>
        </View>
      )}

      {activeOrder ? (
        <PosOrderDock
          onPress={openOrders}
          order={activeOrder}
        />
      ) : null}

      <PosBarcodeScanner
        onClose={() => setScannerVisible(false)}
        onScanned={handleBarcodeScanned}
        visible={scannerVisible && catalogAvailable}
      />

      {orderOverlay.kind === 'orders' && catalogAvailable ? (
        <PosOrderPanel
          activeOrderId={activeOrder?.id ?? null}
          busy={orderBusy || ordersLoading}
          loading={ordersLoading}
          notice={orderNotice?.surface === 'catalog' && !orderNotice.error ? null : orderNotice}
          onAddProducts={startAddingProducts}
          onCancelOrder={(order) => void cancelOrder(order)}
          onCheckout={openCheckout}
          onClose={() => setOrderOverlay({ kind: 'closed' })}
          onCreateOrder={() => void createOrder()}
          onDismissNotice={() => setOrderNotice(null)}
          onRemoveItem={(order, item) => void removeOrderItem(order, item)}
          onReceiveSupply={(order, request) => void receiveSupply(order, request)}
          onReloadWarehouseAssignees={() => void loadWarehouseAssignees()}
          onRequestSupply={(order, assignedTo) => void requestSupply(order, assignedTo)}
          onSelectOrder={setActiveOrderId}
          onUpdateQuantity={(order, item, quantity) => void updateOrderQuantity(order, item, quantity)}
          onUpdateCustomer={updateOrderCustomer}
          onUpdateItemWarehouseNotes={updateItemWarehouseNotes}
          orders={orders}
          onUpdateWarehouseNotes={updateOrderWarehouseNotes}
          sessionOpen={session?.status === 'open'}
          visible
          warehouseAssignees={warehouseAssignees}
          warehouseAssigneesError={warehouseAssigneesError}
          warehouseAssigneesLoading={warehouseAssigneesLoading}
        />
      ) : null}

      {orderOverlay.kind === 'checkout' && checkoutOrder && catalogAvailable ? (
        <PosCheckoutModal
          onBack={returnToOrder}
          onDone={finishCheckout}
          onSubmit={submitCheckout}
          order={checkoutOrder}
          visible
        />
      ) : null}

      <Portal>
        <Dialog onDismiss={() => !closing && setCloseDialogVisible(false)} visible={closeDialogVisible}>
          <Dialog.Icon icon="cash-check" />
          <Dialog.Title style={styles.dialogTitle}>Cerrar {session?.cash_register.code ?? 'caja'}</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogHelp}>Ingresa el efectivo físico contado al terminar el turno.</Text>
            <View style={styles.expectedRow}>
              <Text style={styles.expectedLabel}>Efectivo esperado</Text>
              <Text style={styles.expectedValue}>S/ {Number(session?.expected_amount ?? 0).toFixed(2)}</Text>
            </View>
            <TextInput
              activeOutlineColor="#8F1D2C"
              autoFocus
              error={Boolean(closeError)}
              keyboardType="decimal-pad"
              label="Monto de cierre *"
              left={<TextInput.Affix text="S/" />}
              mode="outlined"
              onChangeText={(value) => { setCountedAmount(value); setCloseError(''); }}
              outlineColor="#879692"
              style={styles.closeInput}
              value={countedAmount}
            />
            {closeError ? <Text style={styles.closeError}>{closeError}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={closing} onPress={() => setCloseDialogVisible(false)}>Cancelar</Button>
            <Button
              buttonColor="#8F1D2C"
              disabled={closing}
              loading={closing}
              mode="contained"
              onPress={() => void closeCashRegister()}
              textColor="#FFFFFF"
            >
              Cerrar caja
            </Button>
          </Dialog.Actions>
        </Dialog>
        <Snackbar
          duration={orderNotice?.error ? 6000 : 1800}
          elevation={4}
          onDismiss={() => setOrderNotice(null)}
          style={orderNotice?.error ? styles.errorSnackbar : styles.successSnackbar}
          visible={Boolean(orderNotice) && orderOverlay.kind === 'closed'}
          wrapperStyle={activeOrder ? styles.snackbarAboveOrder : undefined}
        >
          {orderNotice?.message ?? ''}
        </Snackbar>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' },
  loader: { flex: 1 },
  topBar: { minHeight: 68, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#D7E0DE', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  identity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  identityText: { flex: 1, minWidth: 0 },
  icon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#FFE5E5', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#172423', fontSize: 14, fontWeight: '900' },
  cashRegister: { marginTop: 2, color: '#60706E', fontSize: 9 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  searchAction: { position: 'relative' },
  activeFilterCount: { position: 'absolute', top: -2, right: -2, minWidth: 17, height: 17, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#FF4D4D' },
  activeFilterCountText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
  actionButton: { margin: 0, backgroundColor: '#EAEFEE' },
  menuButton: { margin: 0, backgroundColor: '#EAEFEE' },
  workspace: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  error: { marginTop: 10, color: '#8F1D2C', fontSize: 11, fontWeight: '700' },
  dialogTitle: { textAlign: 'center' },
  dialogHelp: { color: '#60706E', fontSize: 11, lineHeight: 17, textAlign: 'center' },
  expectedRow: { marginTop: 16, padding: 12, borderRadius: 9, backgroundColor: '#EAEFEE', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  expectedLabel: { color: '#60706E', fontSize: 9, fontWeight: '800' },
  expectedValue: { color: '#B4232D', fontSize: 13, fontWeight: '900' },
  closeInput: { marginTop: 14, backgroundColor: '#FFFFFF' },
  closeError: { marginTop: 6, color: '#8F1D2C', fontSize: 9, fontWeight: '700' },
  errorSnackbar: { backgroundColor: '#8F1D2C' },
  successSnackbar: { backgroundColor: '#247451' },
  snackbarAboveOrder: { bottom: 58 },
});
