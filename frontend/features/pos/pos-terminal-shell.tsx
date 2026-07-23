import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Dialog, Divider, Icon, IconButton, Menu, Portal, Snackbar, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { PosBarcodeScanner } from './pos-barcode-scanner';
import { isMeasuredProduct, type PosMeasuredProduct, type PosSaleUnitCode } from './pos-measurement';
import { PosOrderDock, PosOrderPanel } from './pos-order-panel';
import { PosProductCatalog } from './pos-product-catalog';
import { PosQuantityEditor } from './pos-quantity-editor';
import type { CashRegisterSession, PosCatalogProduct, PosOrder, PosOrderItem } from './pos-types';

type OrderNotice = {
  message: string;
  error: boolean;
};

function requestErrorMessage(requestError: any, fallback: string) {
  const validationErrors = requestError?.response?.data?.errors;
  const firstValidationError = validationErrors ? Object.values(validationErrors).flat()[0] : null;

  return typeof firstValidationError === 'string'
    ? firstValidationError
    : requestError?.response?.data?.message ?? fallback;
}

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
  const [ordersVisible, setOrdersVisible] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderBusy, setOrderBusy] = useState(false);
  const [addingProductId, setAddingProductId] = useState<number | null>(null);
  const [orderNotice, setOrderNotice] = useState<OrderNotice | null>(null);
  const [quantityProduct, setQuantityProduct] = useState<PosMeasuredProduct | null>(null);
  const orderMutation = useRef(false);

  useEffect(() => {
    async function loadSession() {
      try {
        const response = await api.get(`/cash-register-sessions/${cashSessionId}`);
        setSession(response.data.data);
      } catch {
        setError('No se pudo cargar la caja abierta.');
      } finally {
        setLoading(false);
      }
    }

    void loadSession();
  }, [cashSessionId]);

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

  const activeOrder = useMemo(
    () => orders.find((order) => order.id === activeOrderId) ?? orders.at(-1) ?? null,
    [activeOrderId, orders],
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
    setActiveOrderId(updatedOrder.id);
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

  async function requestNewOrder(): Promise<PosOrder> {
    if (!session) throw new Error('No hay una apertura de caja disponible.');

    const response = await api.post(`/cash-register-sessions/${session.id}/orders`);
    const order = response.data.data as PosOrder;
    replaceOrder(order);

    return order;
  }

  async function createOrder() {
    const order = await runOrderMutation(requestNewOrder);
    if (!order) return;
    setOrdersVisible(true);
    setOrderNotice({ message: `Orden ${order.number} creada.`, error: false });
  }

  async function addProduct(product: PosCatalogProduct) {
    if (!session || orderMutation.current) return;

    const currentQuantity = activeOrderQuantities[product.id] ?? 0;
    const configuredMinimums = product.price_tiers
      .map((tier) => Number(tier.min_quantity))
      .filter((minimum) => Number.isFinite(minimum));
    const addQuantity = currentQuantity > 0
      ? 1
      : Math.max(1, configuredMinimums.length > 0 ? Math.min(...configuredMinimums) : 1);
    const targetQuantity = currentQuantity + addQuantity;
    const hasApplicablePrice = product.price_tiers.some((tier) => (
      Number(tier.min_quantity) <= targetQuantity
      && (tier.max_quantity === null || Number(tier.max_quantity) >= targetQuantity)
    ));
    if (!hasApplicablePrice) {
      setOrderNotice({
        message: `${product.name} no tiene un precio configurado para esta cantidad.`,
        error: true,
      });
      return;
    }

    setAddingProductId(product.id);
    const updatedOrder = await runOrderMutation(async () => {
      const order = activeOrder ?? await requestNewOrder();
      const response = await api.post(
        `/cash-register-sessions/${session.id}/orders/${order.id}/items`,
        { product_id: product.id, quantity: addQuantity },
      );

      return response.data.data as PosOrder;
    });
    setAddingProductId(null);

    if (!updatedOrder) return;
    replaceOrder(updatedOrder);
    setOrderNotice({ message: `${product.name} agregado a la orden.`, error: false });
  }

  function selectCatalogProduct(product: PosCatalogProduct) {
    if (isMeasuredProduct(product)) {
      setQuantityProduct(product);
      return;
    }

    void addProduct(product);
  }

  async function saveMeasuredQuantity(
    inputQuantity: number,
    unitCode: PosSaleUnitCode,
  ): Promise<boolean> {
    if (!session || !quantityProduct || orderMutation.current) return false;

    const product = quantityProduct;
    const existingItem = activeOrder?.items.find((item) => item.product_id === product.id) ?? null;
    setAddingProductId(product.id);

    const updatedOrder = await runOrderMutation(async () => {
      const order = activeOrder ?? await requestNewOrder();
      const payload = { quantity: inputQuantity, unit_code: unitCode };
      const response = existingItem
        ? await api.patch(
          `/cash-register-sessions/${session.id}/orders/${order.id}/items/${existingItem.id}`,
          payload,
        )
        : await api.post(
          `/cash-register-sessions/${session.id}/orders/${order.id}/items`,
          { product_id: product.id, ...payload },
        );

      return response.data.data as PosOrder;
    });

    setAddingProductId(null);
    if (!updatedOrder) return false;

    replaceOrder(updatedOrder);
    setQuantityProduct(null);
    setOrderNotice({
      message: existingItem
        ? `Cantidad de ${product.name} actualizada.`
        : `${product.name} agregado a la orden.`,
      error: false,
    });

    return true;
  }

  function editMeasuredOrderItem(item: PosOrderItem) {
    if (!isMeasuredProduct(item.product)) return;

    setOrdersVisible(false);
    setQuantityProduct(item.product);
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

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <ActivityIndicator color="#28738A" size="large" style={styles.loader} />
      </SafeAreaView>
    );
  }

  const catalogAvailable = !error && session?.status === 'open';

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.identity}>
          <View style={styles.icon}><Icon color="#28738A" size={22} source="point-of-sale" /></View>
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
                iconColor="#3C353E"
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
              iconColor="#3C353E"
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
                iconColor="#3C353E"
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
              leadingIcon="receipt-text-outline"
              onPress={() => {
                setMenuVisible(false);
                setOrdersVisible(true);
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
          <Icon color="#A44256" size={38} source="alert-circle-outline" />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : session?.status === 'open' ? (
        <PosProductCatalog
          activeFilterIds={activeCatalogFilterIds}
          activeOrderQuantities={activeOrderQuantities}
          addingProductId={addingProductId}
          cashSessionId={cashSessionId}
          onAddProduct={selectCatalogProduct}
          onQueryChange={setCatalogQuery}
          onSearchExpandedChange={setSearchExpanded}
          onToggleFilter={toggleCatalogFilter}
          orderBusy={orderBusy || ordersLoading}
          query={catalogQuery}
          searchExpanded={searchExpanded}
        />
      ) : (
        <View style={styles.workspace}>
          <Icon color="#A44256" size={38} source="lock-outline" />
          <Text style={styles.error}>Esta apertura de caja ya está cerrada.</Text>
        </View>
      )}

      {activeOrder ? (
        <PosOrderDock
          onPress={() => setOrdersVisible(true)}
          order={activeOrder}
        />
      ) : null}

      <PosBarcodeScanner
        onClose={() => setScannerVisible(false)}
        onScanned={handleBarcodeScanned}
        visible={scannerVisible && catalogAvailable}
      />

      <PosQuantityEditor
        busy={orderBusy || ordersLoading}
        currentBaseQuantity={quantityProduct ? activeOrderQuantities[quantityProduct.id] ?? 0 : 0}
        onClose={() => setQuantityProduct(null)}
        onConfirm={saveMeasuredQuantity}
        product={quantityProduct}
      />

      <PosOrderPanel
        activeOrderId={activeOrder?.id ?? null}
        busy={orderBusy || ordersLoading}
        loading={ordersLoading}
        onCancelOrder={(order) => void cancelOrder(order)}
        onClose={() => setOrdersVisible(false)}
        onCreateOrder={() => void createOrder()}
        onEditMeasuredItem={editMeasuredOrderItem}
        onRemoveItem={(order, item) => void removeOrderItem(order, item)}
        onSelectOrder={setActiveOrderId}
        onUpdateQuantity={(order, item, quantity) => void updateOrderQuantity(order, item, quantity)}
        orders={orders}
        visible={ordersVisible && catalogAvailable}
      />

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
              activeOutlineColor="#A44256"
              autoFocus
              error={Boolean(closeError)}
              keyboardType="decimal-pad"
              label="Monto de cierre *"
              left={<TextInput.Affix text="S/" />}
              mode="outlined"
              onChangeText={(value) => { setCountedAmount(value); setCloseError(''); }}
              outlineColor="#D8D1DA"
              style={styles.closeInput}
              value={countedAmount}
            />
            {closeError ? <Text style={styles.closeError}>{closeError}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={closing} onPress={() => setCloseDialogVisible(false)}>Cancelar</Button>
            <Button
              buttonColor="#A44256"
              disabled={closing}
              loading={closing}
              mode="contained"
              onPress={() => void closeCashRegister()}
            >
              Cerrar caja
            </Button>
          </Dialog.Actions>
        </Dialog>
        <Snackbar
          duration={2200}
          onDismiss={() => setOrderNotice(null)}
          style={orderNotice?.error ? styles.errorSnackbar : styles.successSnackbar}
          visible={Boolean(orderNotice)}
        >
          {orderNotice?.message ?? ''}
        </Snackbar>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F8F9' },
  loader: { flex: 1 },
  topBar: { minHeight: 68, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#DCE3E5', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  identity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  identityText: { flex: 1, minWidth: 0 },
  icon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#E6F2F5', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#302A33', fontSize: 14, fontWeight: '900' },
  cashRegister: { marginTop: 2, color: '#7C757F', fontSize: 9 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  searchAction: { position: 'relative' },
  activeFilterCount: { position: 'absolute', top: -2, right: -2, minWidth: 17, height: 17, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#D18A25' },
  activeFilterCountText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
  actionButton: { margin: 0, backgroundColor: '#F2F4F5' },
  menuButton: { margin: 0, backgroundColor: '#ECE8ED' },
  workspace: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  error: { marginTop: 10, color: '#A44256', fontSize: 11, fontWeight: '700' },
  dialogTitle: { textAlign: 'center' },
  dialogHelp: { color: '#777079', fontSize: 11, lineHeight: 17, textAlign: 'center' },
  expectedRow: { marginTop: 16, padding: 12, borderRadius: 9, backgroundColor: '#F5F1F6', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  expectedLabel: { color: '#746C77', fontSize: 9, fontWeight: '800' },
  expectedValue: { color: '#76557E', fontSize: 13, fontWeight: '900' },
  closeInput: { marginTop: 14, backgroundColor: '#FFFFFF' },
  closeError: { marginTop: 6, color: '#A44256', fontSize: 9, fontWeight: '700' },
  errorSnackbar: { backgroundColor: '#8D3448' },
  successSnackbar: { backgroundColor: '#28738A' },
});
