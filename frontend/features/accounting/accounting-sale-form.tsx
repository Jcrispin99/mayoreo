import axios from 'axios';
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
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
  Menu,
  Text,
  TextInput,
} from 'react-native-paper';
import { ModuleLayout } from '../../components/module/module-layout';
import { ProductableLines } from '../../components/productables/productable-lines';
import { getVisibleMenu } from '../../config/menu';
import { api } from '../../lib/api';
import type { Customer } from '../customers/customer-types';
import type { Warehouse } from '../inventory/inventory-types';
import type {
  CashRegisterSession,
  DocumentSeries,
  PosPaymentMethod,
  PosPaymentMethodDefinition,
} from '../pos/pos-types';
import type {
  AccountingFormReferences,
  AccountingProduct,
  AccountingSale,
  AccountingSaleDraftLine,
} from './accounting-types';
import { SaleProductableEditor } from './sale-productable-editor';
import { saleLinePreview } from './sale-productable-pricing';

type AccountingSaleFormProps = {
  saleId?: string;
};

type OpenMenu =
  | { type: 'customer' | 'warehouse' | 'series' | 'cash-session' }
  | null;

const ACCOUNTING_MODULE = getVisibleMenu().find((module) => module.id === 'accounting');
const EMPTY_REFERENCES: AccountingFormReferences = {
  customers: [],
  warehouses: [],
  products: [],
  series: [],
  paymentMethods: [],
  cashSessions: [],
  units: [],
};
const PAYMENT_ICONS: Record<PosPaymentMethod, string> = {
  cash: 'cash',
  card: 'credit-card-outline',
  yape: 'cellphone-check',
  plin: 'cellphone-arrow-down',
  bank_transfer: 'bank-transfer',
};
const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  yape: 'Yape',
  plin: 'Plin',
  bank_transfer: 'Transferencia',
};
function localDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function money(value: string | number) {
  return `S/ ${Number(value).toFixed(2)}`;
}

function requestErrorMessage(requestError: unknown) {
  if (!axios.isAxiosError(requestError)) {
    return 'No se pudo registrar la venta.';
  }

  const responseData = requestError.response?.data as {
    errors?: Record<string, string | string[]>;
    message?: string;
  } | undefined;
  const firstValidationError = responseData?.errors
    ? Object.values(responseData.errors).flat()[0]
    : null;

  if (typeof firstValidationError === 'string') return firstValidationError;
  return responseData?.message ?? 'No se pudo registrar la venta.';
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function AccountingSaleForm({ saleId }: AccountingSaleFormProps) {
  const detailMode = Boolean(saleId);
  const [references, setReferences] = useState(EMPTY_REFERENCES);
  const [sale, setSale] = useState<AccountingSale | null>(null);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [seriesId, setSeriesId] = useState<number | null>(null);
  const [soldAt, setSoldAt] = useState(localDate());
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<AccountingSaleDraftLine[]>([]);
  const [nextLineKey, setNextLineKey] = useState(1);
  const [lineEditorVisible, setLineEditorVisible] = useState(false);
  const [selectedLine, setSelectedLine] = useState<AccountingSaleDraftLine | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>('cash');
  const [cashSessionId, setCashSessionId] = useState<number | null>(null);
  const [receivedAmount, setReceivedAmount] = useState('');
  const [reference, setReference] = useState('');
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadReferences = useCallback(async () => {
    const [
      customersResponse,
      warehousesResponse,
      productsResponse,
      seriesResponse,
      methodsResponse,
      sessionsResponse,
      unitsResponse,
    ] = await Promise.all([
      api.get('/customers?is_active=true'),
      api.get('/warehouses?is_active=true'),
      api.get('/products?is_active=true'),
      api.get('/document-series?document_type=sales_ticket&is_active=true'),
      api.get('/pos/payment-methods'),
      api.get('/cash-register-sessions?status=open'),
      api.get('/units-of-measure'),
    ]);

    const nextReferences: AccountingFormReferences = {
      customers: (customersResponse.data.data ?? []).filter((item: Customer) => item.is_active),
      warehouses: (warehousesResponse.data.data ?? []).filter((item: Warehouse) => item.is_active),
      products: (productsResponse.data.data ?? []).filter((item: AccountingProduct) => item.is_active),
      series: (seriesResponse.data.data ?? []).filter(
        (item: DocumentSeries) => item.is_active && item.document_type === 'sales_ticket',
      ),
      paymentMethods: methodsResponse.data.data ?? [],
      cashSessions: (sessionsResponse.data.data ?? []).filter(
        (item: CashRegisterSession) => item.status === 'open',
      ),
      units: unitsResponse.data.data ?? [],
    };
    setReferences(nextReferences);
    setCustomerId((current) => current ?? nextReferences.customers[0]?.id ?? null);
    setWarehouseId((current) => current ?? nextReferences.warehouses[0]?.id ?? null);
    setSeriesId((current) => current ?? nextReferences.series[0]?.id ?? null);
    setPaymentMethod((current) => (
      nextReferences.paymentMethods.some((item) => item.code === current)
        ? current
        : nextReferences.paymentMethods[0]?.code ?? 'cash'
    ));
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');

      try {
        if (saleId) {
          const response = await api.get(`/sales/${saleId}`);
          setSale(response.data.data);
        } else {
          await loadReferences();
        }
      } catch (requestError) {
        setError(requestErrorMessage(requestError));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [loadReferences, saleId]);

  const selectedCustomer = references.customers.find((item) => item.id === customerId);
  const selectedWarehouse = references.warehouses.find((item) => item.id === warehouseId);
  const selectedSeries = references.series.find((item) => item.id === seriesId);
  const availableCashSessions = useMemo(() => references.cashSessions.filter(
    (session) => session.cash_register?.store_id === selectedWarehouse?.store_id,
  ), [references.cashSessions, selectedWarehouse?.store_id]);
  const selectedCashSession = availableCashSessions.find((item) => item.id === cashSessionId);
  const previews = useMemo(
    () => lines.map((line) => saleLinePreview(line, references.products)),
    [lines, references.products],
  );
  const rawTotal = previews.reduce((total, preview) => total + (preview?.total ?? 0), 0);
  const payableTotal = Math.round((rawTotal + Number.EPSILON) * 100) / 100;
  const usedProductIds = useMemo(
    () => new Set(lines.map((line) => line.productId)),
    [lines],
  );
  const productableLines = lines.map((line, index) => {
    const product = references.products.find((item) => item.id === line.productId);
    const unit = references.units.find((item) => item.code === line.unitCode);
    const preview = previews[index];

    return {
      key: line.key,
      productName: product?.name ?? `Producto #${line.productId}`,
      sku: product?.sku,
      details: [
        `Cantidad: ${Number(line.quantity).toLocaleString('es-PE')} ${unit?.name ?? line.unitCode}`,
        preview
          ? `Tipo de precio: ${preview.tier.label ?? 'Precio'}`
          : 'Tipo de precio: sin precio disponible',
        preview
          ? `Precio: ${money(preview.tier.unit_price)} por ${product?.base_unit?.code ?? 'unidad'}`
          : 'Precio: —',
      ],
      subtotal: preview?.total ?? null,
    };
  });

  useEffect(() => {
    if (paymentMethod === 'cash' && !cashSessionId && availableCashSessions[0]) {
      setCashSessionId(availableCashSessions[0].id);
    } else if (
      cashSessionId
      && !availableCashSessions.some((session) => session.id === cashSessionId)
    ) {
      setCashSessionId(availableCashSessions[0]?.id ?? null);
    }
  }, [availableCashSessions, cashSessionId, paymentMethod]);

  useEffect(() => {
    if (paymentMethod === 'cash' && !receivedAmount && payableTotal > 0) {
      setReceivedAmount(payableTotal.toFixed(2));
    }
  }, [payableTotal, paymentMethod, receivedAmount]);

  function openNewLine() {
    setSelectedLine(null);
    setLineEditorVisible(true);
  }

  function openLine(key: number | string) {
    const line = lines.find((candidate) => candidate.key === key);
    if (!line) return;
    setSelectedLine(line);
    setLineEditorVisible(true);
  }

  function saveLine(line: AccountingSaleDraftLine) {
    if (line.key > 0) {
      setLines((current) => current.map((candidate) => (
        candidate.key === line.key ? line : candidate
      )));
      setSelectedLine(null);
      return;
    }

    setLines((current) => [...current, { ...line, key: nextLineKey }]);
    setNextLineKey((current) => current + 1);
    setSelectedLine(null);
  }

  function removeLine(key: number) {
    setLines((current) => current.filter((line) => line.key !== key));
    setSelectedLine(null);
  }

  async function save() {
    const invalidLine = lines.some((line, index) => (
      !line.productId
      || !line.unitCode
      || Number(line.quantity) <= 0
      || previews[index] === null
    ));
    const duplicateProducts = new Set(lines.map((line) => line.productId)).size !== lines.length;

    if (!customerId || !warehouseId || !seriesId || !soldAt.trim()) {
      setError('Selecciona cliente, almacén, serie y fecha.');
      return;
    }
    if (lines.length === 0 || invalidLine || duplicateProducts) {
      setError('Agrega productos distintos con cantidad, unidad y precio válidos.');
      return;
    }
    if (!references.paymentMethods.some((method) => method.code === paymentMethod)) {
      setError('Selecciona un método de pago válido.');
      return;
    }
    if (paymentMethod === 'cash') {
      if (!cashSessionId) {
        setError('Abre o selecciona una caja de la misma tienda para recibir efectivo.');
        return;
      }
      if (!Number.isFinite(Number(receivedAmount)) || Number(receivedAmount) < payableTotal) {
        setError('El efectivo recibido debe cubrir el total de la venta.');
        return;
      }
    }

    setSaving(true);
    setError('');

    try {
      const payment = paymentMethod === 'cash'
        ? {
          method: 'cash' as const,
          received_amount: Number(receivedAmount).toFixed(2),
          cash_register_session_id: cashSessionId,
        }
        : {
          method: paymentMethod,
          reference: reference.trim() || null,
        };
      const response = await api.post('/sales', {
        customer_id: customerId,
        warehouse_id: warehouseId,
        document_series_id: seriesId,
        sold_at: soldAt.trim(),
        expected_total: payableTotal.toFixed(2),
        notes: notes.trim() || null,
        items: lines.map((line) => ({
          product_id: line.productId,
          quantity: line.quantity.trim(),
          unit_code: line.unitCode,
        })),
        payment,
      });
      const createdSale = response.data.data as AccountingSale;
      router.replace({
        pathname: '/accounting/sales/[saleId]',
        params: { saleId: String(createdSale.id) },
      } as Href);
    } catch (requestError) {
      if (axios.isAxiosError(requestError) && requestError.response?.status === 409) {
        const changedTotal = requestError.response.data?.data?.payable_total;
        setError(
          `${requestError.response.data?.message ?? 'El total cambió.'}`
          + (changedTotal ? ` Nuevo total: ${money(changedTotal)}.` : '')
          + ' Se actualizaron los precios; revisa antes de volver a confirmar.',
        );
        try {
          await loadReferences();
        } catch {
          // Conserva las líneas y el mensaje de conflicto para permitir reintentar.
        }
      } else {
        setError(requestErrorMessage(requestError));
      }
    } finally {
      setSaving(false);
    }
  }

  if (!ACCOUNTING_MODULE) return null;

  if (detailMode) {
    const payment = sale?.payments[0];

    return (
      <ModuleLayout module={ACCOUNTING_MODULE} selectedItemId="sales">
        <View style={styles.screen}>
          {loading ? (
            <ActivityIndicator color="#B4232D" size="large" style={styles.loader} />
          ) : sale ? (
            <ScrollView contentContainerStyle={styles.content}>
              <View style={styles.header}>
                <Button compact icon="arrow-left" mode="text" onPress={() => router.back()}>
                  Volver
                </Button>
                <View style={[
                  styles.sourceBadge,
                  sale.source === 'pos' ? styles.posBadge : styles.wholesaleBadge,
                ]}>
                  <Text style={styles.sourceBadgeText}>
                    {sale.source === 'pos' ? 'Venta POS' : 'Venta mayorista'}
                  </Text>
                </View>
              </View>

              <Text style={styles.title}>
                {sale.primary_document?.full_number ?? `Venta #${sale.id}`}
              </Text>
              <Text style={styles.subtitle}>
                Venta completada e inmutable. El pago, correlativo y movimiento de stock están registrados.
              </Text>
              <View style={styles.detailCard}>
                <DetailRow
                  label="Fecha"
                  value={new Intl.DateTimeFormat('es-PE', {
                    dateStyle: 'long',
                    timeStyle: 'short',
                  }).format(new Date(sale.sold_at))}
                />
                <DetailRow
                  label="Cliente"
                  value={sale.customer_name || 'Cliente de mostrador'}
                />
                {sale.customer_document ? (
                  <DetailRow label="Documento" value={sale.customer_document} />
                ) : null}
                <DetailRow label="Almacén" value={sale.warehouse?.name ?? `#${sale.warehouse_id}`} />
                <DetailRow
                  label="Método de pago"
                  value={payment ? PAYMENT_LABELS[payment.method] ?? payment.method : 'No registrado'}
                />
                {payment?.reference ? <DetailRow label="Referencia" value={payment.reference} /> : null}
                {payment?.received_amount ? (
                  <DetailRow label="Efectivo recibido" value={money(payment.received_amount)} />
                ) : null}
                {sale.notes ? <DetailRow label="Observación" value={sale.notes} /> : null}
              </View>

              <Text style={styles.sectionTitle}>Productos</Text>
              <View style={styles.detailLines}>
                <ProductableLines
                  emptyText="Esta venta no tiene productos registrados."
                  emptyTitle="Sin productos"
                  lines={sale.items.map((item) => ({
                    key: item.id,
                    productName: item.product?.name ?? `Producto #${item.product_id}`,
                    sku: item.product?.sku,
                    details: [
                      `Cantidad: ${Number(item.input_quantity).toLocaleString('es-PE')} ${item.input_unit?.name ?? item.input_unit?.code ?? ''}`,
                      `Tipo de precio: ${item.price_tier?.label ?? 'Precio'}`,
                      `Precio: ${money(item.unit_price)} por ${item.product?.base_unit?.code ?? 'unidad'}`,
                    ],
                    subtotal: Number(item.line_total),
                  }))}
                  readOnly
                  total={Number(sale.payable_total)}
                  totalLabel="Total cobrado"
                />
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </ScrollView>
          ) : (
            <View style={styles.centerState}>
              <Icon color="#60706E" size={42} source="receipt-text-remove-outline" />
              <Text style={styles.centerTitle}>No se pudo abrir la venta</Text>
              <Text style={styles.centerText}>{error}</Text>
              <Button mode="outlined" onPress={() => router.back()}>Volver</Button>
            </View>
          )}
        </View>
      </ModuleLayout>
    );
  }

  return (
    <ModuleLayout module={ACCOUNTING_MODULE} selectedItemId="sales">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.screen}
      >
        {loading ? (
          <ActivityIndicator color="#B4232D" size="large" style={styles.loader} />
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Button compact icon="arrow-left" mode="text" onPress={() => router.back()}>
                Volver
              </Button>
              <Button
                buttonColor="#FF4D4D"
                disabled={saving}
                loading={saving}
                mode="contained"
                onPress={() => void save()}
              >
                Registrar venta
              </Button>
            </View>
            <Text style={styles.title}>Nueva venta mayorista</Text>
            <Text style={styles.subtitle}>
              Al confirmar se registrarán venta, pago, salida de stock y nota de venta en una sola operación.
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.formSection}>
              <Text style={styles.fieldLabel}>Cliente *</Text>
              <Menu
                anchor={(
                  <Pressable onPress={() => setOpenMenu({ type: 'customer' })} style={styles.selector}>
                    <Text numberOfLines={1} style={styles.selectorText}>
                      {selectedCustomer?.name ?? 'Seleccionar cliente'}
                    </Text>
                    <Icon color="#60706E" size={21} source="chevron-down" />
                  </Pressable>
                )}
                onDismiss={() => setOpenMenu(null)}
                visible={openMenu?.type === 'customer'}
              >
                {references.customers.map((customer) => (
                  <Menu.Item
                    key={customer.id}
                    onPress={() => {
                      setCustomerId(customer.id);
                      setOpenMenu(null);
                    }}
                    title={`${customer.name}${customer.document_number ? ` · ${customer.document_number}` : ''}`}
                  />
                ))}
              </Menu>

              <Text style={styles.fieldLabel}>Almacén *</Text>
              <Menu
                anchor={(
                  <Pressable onPress={() => setOpenMenu({ type: 'warehouse' })} style={styles.selector}>
                    <Text numberOfLines={1} style={styles.selectorText}>
                      {selectedWarehouse?.name ?? 'Seleccionar almacén'}
                    </Text>
                    <Icon color="#60706E" size={21} source="chevron-down" />
                  </Pressable>
                )}
                onDismiss={() => setOpenMenu(null)}
                visible={openMenu?.type === 'warehouse'}
              >
                {references.warehouses.map((warehouse) => (
                  <Menu.Item
                    key={warehouse.id}
                    onPress={() => {
                      setWarehouseId(warehouse.id);
                      setOpenMenu(null);
                    }}
                    title={`${warehouse.name} · ${warehouse.code}`}
                  />
                ))}
              </Menu>

              <Text style={styles.fieldLabel}>Serie de nota de venta *</Text>
              <Menu
                anchor={(
                  <Pressable onPress={() => setOpenMenu({ type: 'series' })} style={styles.selector}>
                    <Text style={styles.selectorText}>
                      {selectedSeries
                        ? `${selectedSeries.series_code} · próximo ${selectedSeries.next_number}`
                        : 'Seleccionar serie'}
                    </Text>
                    <Icon color="#60706E" size={21} source="chevron-down" />
                  </Pressable>
                )}
                onDismiss={() => setOpenMenu(null)}
                visible={openMenu?.type === 'series'}
              >
                {references.series.map((series) => (
                  <Menu.Item
                    key={series.id}
                    onPress={() => {
                      setSeriesId(series.id);
                      setOpenMenu(null);
                    }}
                    title={`${series.series_code} · próximo ${series.next_number}`}
                  />
                ))}
              </Menu>

              <TextInput
                label="Fecha (AAAA-MM-DD) *"
                mode="flat"
                onChangeText={setSoldAt}
                style={styles.input}
                value={soldAt}
              />
              <TextInput
                label="Observación (opcional)"
                maxLength={1000}
                mode="flat"
                multiline
                numberOfLines={3}
                onChangeText={setNotes}
                style={styles.input}
                value={notes}
              />
            </View>

            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Productos</Text>
                <Text style={styles.sectionHelp}>El precio se calcula según la cantidad y unidad elegidas.</Text>
              </View>
            </View>
            <View style={styles.lines}>
              <ProductableLines
                addDisabled={lines.length >= references.products.length}
                emptyText="Presiona “Agregar” para seleccionar la primera variante de la venta."
                emptyTitle="Aún no hay variantes"
                lines={productableLines}
                onAdd={openNewLine}
                onOpen={openLine}
                total={rawTotal}
                totalLabel="Subtotal"
              />
            </View>

            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Pago</Text>
                <Text style={styles.sectionHelp}>La venta se registra completamente pagada.</Text>
              </View>
            </View>
            <View style={styles.paymentMethods}>
              {references.paymentMethods.map((method: PosPaymentMethodDefinition) => (
                <Pressable
                  key={method.code}
                  onPress={() => {
                    setPaymentMethod(method.code);
                    setError('');
                  }}
                  style={[
                    styles.paymentMethod,
                    paymentMethod === method.code && styles.paymentMethodSelected,
                  ]}
                >
                  <Icon
                    color={paymentMethod === method.code ? '#FFFFFF' : '#B4232D'}
                    size={22}
                    source={PAYMENT_ICONS[method.code]}
                  />
                  <Text style={[
                    styles.paymentMethodText,
                    paymentMethod === method.code && styles.paymentMethodTextSelected,
                  ]}>
                    {method.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {paymentMethod === 'cash' ? (
              <View style={styles.formSection}>
                <Text style={styles.fieldLabel}>Caja abierta de la tienda *</Text>
                <Menu
                  anchor={(
                    <Pressable onPress={() => setOpenMenu({ type: 'cash-session' })} style={styles.selector}>
                      <Text numberOfLines={1} style={styles.selectorText}>
                        {selectedCashSession
                          ? `${selectedCashSession.cash_register.name} · sesión #${selectedCashSession.id}`
                          : 'Seleccionar caja abierta'}
                      </Text>
                      <Icon color="#60706E" size={21} source="chevron-down" />
                    </Pressable>
                  )}
                  onDismiss={() => setOpenMenu(null)}
                  visible={openMenu?.type === 'cash-session'}
                >
                  {availableCashSessions.map((session) => (
                    <Menu.Item
                      key={session.id}
                      onPress={() => {
                        setCashSessionId(session.id);
                        setOpenMenu(null);
                      }}
                      title={`${session.cash_register.name} · sesión #${session.id}`}
                    />
                  ))}
                </Menu>
                {availableCashSessions.length === 0 ? (
                  <Text style={styles.warning}>
                    No hay una caja abierta en la tienda del almacén seleccionado.
                  </Text>
                ) : null}
                <TextInput
                  keyboardType="decimal-pad"
                  label="Efectivo recibido *"
                  mode="flat"
                  onChangeText={setReceivedAmount}
                  style={styles.input}
                  value={receivedAmount}
                />
                <DetailRow
                  label="Vuelto estimado"
                  value={money(Math.max(0, Number(receivedAmount || 0) - payableTotal))}
                />
              </View>
            ) : (
              <TextInput
                label="Referencia de operación (opcional)"
                maxLength={255}
                mode="flat"
                onChangeText={setReference}
                style={[styles.input, styles.referenceInput]}
                value={reference}
              />
            )}

            <View style={styles.totalCard}>
              <View>
                <Text style={styles.totalLabel}>Total a cobrar</Text>
                <Text style={styles.totalHint}>Validado nuevamente por el servidor al confirmar</Text>
              </View>
              <Text style={styles.totalValue}>{money(payableTotal)}</Text>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
      <SaleProductableEditor
        initialItem={selectedLine}
        onClose={() => {
          setLineEditorVisible(false);
          setSelectedLine(null);
        }}
        onDelete={removeLine}
        onSave={saveLine}
        products={references.products}
        unavailableProductIds={usedProductIds}
        units={references.units}
        visible={lineEditorVisible}
      />
    </ModuleLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' },
  loader: { flex: 1 },
  content: { width: '100%', maxWidth: 800, alignSelf: 'center', padding: 20, paddingBottom: 60 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { marginTop: 20, color: '#172423', fontSize: 24, fontWeight: '900' },
  subtitle: { marginTop: 6, color: '#60706E', fontSize: 12, lineHeight: 18 },
  error: { marginTop: 16, padding: 12, borderRadius: 9, color: '#8F1D2C', backgroundColor: '#FCE8EA', fontSize: 11, lineHeight: 17 },
  formSection: { marginTop: 24, gap: 18 },
  fieldLabel: { marginBottom: -9, color: '#60706E', fontSize: 10, fontWeight: '700' },
  selector: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#879692' },
  selectorText: { flex: 1, color: '#172423', fontSize: 13 },
  input: { backgroundColor: 'transparent' },
  sectionHeader: { marginTop: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  sectionTitle: { color: '#172423', fontSize: 16, fontWeight: '900' },
  sectionHelp: { marginTop: 3, color: '#60706E', fontSize: 10 },
  lines: { marginTop: 14, gap: 12 },
  paymentMethods: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  paymentMethod: { minWidth: 112, paddingHorizontal: 13, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#BCD6CC', borderRadius: 11, backgroundColor: '#F2F8F6' },
  paymentMethodSelected: { borderColor: '#B4232D', backgroundColor: '#B4232D' },
  paymentMethodText: { color: '#315E51', fontSize: 11, fontWeight: '800' },
  paymentMethodTextSelected: { color: '#FFFFFF' },
  warning: { marginTop: -9, color: '#A05A2D', fontSize: 10, lineHeight: 15 },
  referenceInput: { marginTop: 18 },
  totalCard: { marginTop: 28, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderWidth: 1, borderColor: '#C9DED5', borderRadius: 14, backgroundColor: '#EDF6F2' },
  totalLabel: { color: '#3E5D54', fontSize: 13, fontWeight: '900' },
  totalHint: { marginTop: 3, color: '#60706E', fontSize: 9 },
  totalValue: { color: '#23634F', fontSize: 22, fontWeight: '900' },
  sourceBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  posBadge: { backgroundColor: '#FFE5E5' },
  wholesaleBadge: { backgroundColor: '#FFE5E5' },
  sourceBadgeText: { color: '#315E51', fontSize: 10, fontWeight: '900' },
  detailCard: { marginTop: 24, padding: 16, gap: 11, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 13, backgroundColor: '#FFFFFF' },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  detailLabel: { color: '#60706E', fontSize: 10, fontWeight: '700' },
  detailValue: { flex: 1, textAlign: 'right', color: '#172423', fontSize: 11, fontWeight: '800' },
  detailLines: { marginTop: 12 },
  centerState: { flex: 1, padding: 30, alignItems: 'center', justifyContent: 'center', gap: 10 },
  centerTitle: { color: '#172423', fontSize: 16, fontWeight: '900' },
  centerText: { maxWidth: 420, textAlign: 'center', color: '#60706E', fontSize: 11 },
});
