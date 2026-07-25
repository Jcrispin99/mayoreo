import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Button, Icon, IconButton, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import {
  cashSuggestions,
  centsToDecimal,
  decimalToCents,
  formatMoneyFromCents,
  formatPosMoney,
  moneyInputToCents,
} from './pos-money';
import type {
  PosCheckoutPayload,
  PosCheckoutResult,
  PosOrder,
  PosPaymentMethod,
  PosPaymentMethodDefinition,
} from './pos-types';

type PosCheckoutModalProps = {
  onBack: () => void;
  onDone: (result: PosCheckoutResult) => Promise<void>;
  onSubmit: (payload: PosCheckoutPayload) => Promise<PosCheckoutResult | null>;
  order: PosOrder;
  visible: boolean;
};

const PAYMENT_METHOD_ICONS: Record<PosPaymentMethod, string> = {
  cash: 'cash',
  card: 'credit-card-outline',
  yape: 'cellphone-check',
  plin: 'cellphone-arrow-down',
  bank_transfer: 'bank-transfer',
};

function requestErrorMessage(requestError: unknown) {
  if (!axios.isAxiosError(requestError)) {
    return 'No se pudo registrar la venta. Inténtalo nuevamente.';
  }

  const responseData = requestError.response?.data as {
    errors?: Record<string, string | string[]>;
    message?: string;
  } | undefined;
  const validationErrors = responseData?.errors;
  const firstValidationError = validationErrors
    ? Object.values(validationErrors).flat()[0]
    : null;

  if (typeof firstValidationError === 'string') return firstValidationError;
  if (typeof responseData?.message === 'string') return responseData.message;
  if (requestError.code === 'ECONNABORTED') {
    return 'No se recibió respuesta a tiempo. Puedes reintentar el cobro de forma segura.';
  }

  return 'No se pudo conectar con el servidor. Conservamos los datos para que puedas reintentar.';
}

function CheckoutSuccess({
  finishing,
  methodLabel,
  onDone,
  result,
}: {
  finishing: boolean;
  methodLabel: string;
  onDone: () => void;
  result: PosCheckoutResult;
}) {
  const cashPayment = result.payment.method === 'cash';

  return (
    <View style={styles.successScreen}>
      <ScrollView
        contentContainerStyle={styles.successContent}
        showsVerticalScrollIndicator={false}
        style={styles.flex}
      >
        <View style={styles.successIcon}>
          <Icon color="#FFFFFF" size={58} source="check-bold" />
        </View>
        <Text accessibilityRole="header" style={styles.successTitle}>Venta completada</Text>
        <Text style={styles.successSubtitle}>El cobro, la venta y la salida de stock quedaron registrados.</Text>

        <View style={styles.successDocument}>
          <Text style={styles.successDocumentLabel}>Nota de venta</Text>
          <Text style={styles.successDocumentNumber}>
            {result.fiscal_document.series_code}-{result.fiscal_document.number}
          </Text>
        </View>

        <View style={styles.successSummary}>
          <View style={styles.successRow}>
            <Text style={styles.successLabel}>Total cobrado</Text>
            <Text style={styles.successValue}>{formatPosMoney(result.sale.payable_total)}</Text>
          </View>
          <View style={styles.successRow}>
            <Text style={styles.successLabel}>Método</Text>
            <Text style={styles.successValue}>{methodLabel}</Text>
          </View>
          {cashPayment ? (
            <>
              <View style={styles.successRow}>
                <Text style={styles.successLabel}>Efectivo recibido</Text>
                <Text style={styles.successValue}>{formatPosMoney(result.payment.received_amount ?? 0)}</Text>
              </View>
              <View style={styles.changeSuccess}>
                <Text style={styles.changeSuccessLabel}>Vuelto a entregar</Text>
                <Text adjustsFontSizeToFit numberOfLines={1} style={styles.changeSuccessValue}>
                  {formatPosMoney(result.payment.change_amount)}
                </Text>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.successFooter}>
        <Button
          buttonColor="#FF4D4D"
          contentStyle={styles.primaryButtonContent}
          disabled={finishing}
          loading={finishing}
          mode="contained"
          onPress={onDone}
        >
          Listo
        </Button>
      </View>
    </View>
  );
}

export function PosCheckoutModal({
  onBack,
  onDone,
  onSubmit,
  order,
  visible,
}: PosCheckoutModalProps) {
  const { width } = useWindowDimensions();
  const wideLayout = width >= 760;
  const totalCents = useMemo(() => decimalToCents(order.total), [order.total]);
  const safeTotalCents = totalCents ?? 0;
  const suggestedAmounts = useMemo(() => cashSuggestions(safeTotalCents), [safeTotalCents]);
  const [method, setMethod] = useState<PosPaymentMethod>('cash');
  const [receivedAmount, setReceivedAmount] = useState(centsToDecimal(safeTotalCents));
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<PosCheckoutResult | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PosPaymentMethodDefinition[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [methodsError, setMethodsError] = useState('');
  const submittingRef = useRef(false);
  const finishingRef = useRef(false);

  const receivedCents = moneyInputToCents(receivedAmount);
  const cashShortfall = method === 'cash' && receivedCents !== null
    ? Math.max(0, safeTotalCents - receivedCents)
    : 0;
  const changeCents = method === 'cash' && receivedCents !== null
    ? Math.max(0, receivedCents - safeTotalCents)
    : null;
  const validPayment = totalCents !== null
    && paymentMethods.some((option) => option.code === method)
    && (method !== 'cash' || (receivedCents !== null && receivedCents >= totalCents));

  const loadPaymentMethods = useCallback(async () => {
    setMethodsLoading(true);
    setMethodsError('');

    try {
      const response = await api.get('/pos/payment-methods');
      const methods = (response.data.data ?? []) as PosPaymentMethodDefinition[];
      setPaymentMethods(methods);
      setMethod((current) => (
        methods.some((option) => option.code === current)
          ? current
          : methods[0]?.code ?? 'cash'
      ));
    } catch {
      setPaymentMethods([]);
      setMethodsError('No se pudieron cargar los métodos de pago.');
    } finally {
      setMethodsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;

    const nextTotalCents = decimalToCents(order.total) ?? 0;
    setMethod('cash');
    setReceivedAmount(centsToDecimal(nextTotalCents));
    setReference('');
    setError('');
    setSubmitting(false);
    setFinishing(false);
    setResult(null);
    submittingRef.current = false;
    finishingRef.current = false;
  }, [order.id, order.total, visible]);

  useEffect(() => {
    if (visible) void loadPaymentMethods();
  }, [loadPaymentMethods, visible]);

  function selectMethod(nextMethod: PosPaymentMethod) {
    if (submittingRef.current) return;
    setMethod(nextMethod);
    setError('');
  }

  async function confirmCheckout() {
    if (submittingRef.current || !validPayment || totalCents === null) return;

    const payment: PosCheckoutPayload['payment'] = method === 'cash'
      ? {
        method: 'cash',
        received_amount: centsToDecimal(receivedCents ?? 0),
        reference: null,
      }
      : {
        method,
        reference: reference.trim() || null,
      };

    submittingRef.current = true;
    setSubmitting(true);
    setError('');

    try {
      const checkoutResult = await onSubmit({
        expected_total: centsToDecimal(totalCents),
        payment,
      });
      if (checkoutResult) setResult(checkoutResult);
    } catch (requestError: unknown) {
      setError(requestErrorMessage(requestError));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function finishCheckout() {
    if (!result || finishingRef.current) return;

    finishingRef.current = true;
    setFinishing(true);
    try {
      await onDone(result);
    } finally {
      finishingRef.current = false;
      setFinishing(false);
    }
  }

  function requestClose() {
    if (submittingRef.current || finishingRef.current || result) return;
    onBack();
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={requestClose}
      presentationStyle="fullScreen"
      visible={visible}
    >
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.screen}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          {result ? (
            <CheckoutSuccess
              finishing={finishing}
              methodLabel={
                paymentMethods.find((option) => option.code === result.payment.method)?.label
                  ?? result.payment.method
              }
              onDone={() => void finishCheckout()}
              result={result}
            />
          ) : (
            <>
              <View style={styles.header}>
                <View style={styles.headerInner}>
                  <IconButton
                    accessibilityLabel="Volver a la orden"
                    disabled={submitting}
                    icon="arrow-left"
                    onPress={requestClose}
                    size={23}
                    style={styles.backButton}
                  />
                  <View style={styles.headerText}>
                    <Text numberOfLines={1} style={styles.headerTitle}>Cobrar Orden {order.number}</Text>
                    <Text numberOfLines={1} style={styles.headerSubtitle}>Confirma cómo recibiste el pago</Text>
                  </View>
                </View>
              </View>

              <ScrollView
                contentContainerStyle={[styles.content, wideLayout && styles.wideContent]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={styles.flex}
              >
                <View style={[styles.summaryColumn, wideLayout && styles.wideColumn]}>
                  <View style={styles.totalCard}>
                    <Text style={styles.eyebrow}>TOTAL A COBRAR</Text>
                    <Text adjustsFontSizeToFit numberOfLines={1} style={styles.total}>
                      {formatMoneyFromCents(safeTotalCents)}
                    </Text>
                    <View style={styles.orderMeta}>
                      <View style={styles.orderMetaIcon}>
                        <Icon color="#B4232D" size={20} source="receipt-text-outline" />
                      </View>
                      <View style={styles.orderMetaText}>
                        <Text style={styles.orderMetaTitle}>Orden {order.number}</Text>
                        <Text style={styles.orderMetaDetail}>
                          {order.items.length} {order.items.length === 1 ? 'producto preparado' : 'productos preparados'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.checkoutNote}>
                    <Icon color="#60706E" size={20} source="shield-check-outline" />
                    <Text style={styles.checkoutNoteText}>
                      El total será validado nuevamente antes de registrar la venta y descontar el stock.
                    </Text>
                  </View>
                </View>

                <View style={[styles.paymentColumn, wideLayout && styles.wideColumn]}>
                  <View>
                    <Text style={styles.sectionTitle}>Método de pago</Text>
                    <Text style={styles.sectionHelp}>Selecciona una sola forma de pago para esta venta.</Text>
                  </View>

                  {methodsLoading ? (
                    <View style={styles.methodsLoading}>
                      <ActivityIndicator color="#B4232D" size="small" />
                      <Text style={styles.methodsLoadingText}>Cargando métodos de pago…</Text>
                    </View>
                  ) : methodsError ? (
                    <View style={styles.methodsError}>
                      <Text style={styles.fieldError}>{methodsError}</Text>
                      <Button compact mode="text" onPress={() => void loadPaymentMethods()}>
                        Reintentar
                      </Button>
                    </View>
                  ) : (
                    <View style={styles.methods}>
                      {paymentMethods.map((option) => {
                        const selected = method === option.code;
                        return (
                          <Pressable
                            accessibilityLabel={`${option.label}. ${option.description}`}
                            accessibilityRole="radio"
                            accessibilityState={{ disabled: submitting, selected }}
                            disabled={submitting}
                            key={option.code}
                            onPress={() => selectMethod(option.code)}
                            style={({ pressed }) => [
                              styles.methodCard,
                              selected && styles.methodCardSelected,
                              pressed && !submitting && styles.methodCardPressed,
                              submitting && styles.disabledControl,
                            ]}
                          >
                            <View style={[styles.methodIcon, selected && styles.methodIconSelected]}>
                              <Icon
                                color={selected ? '#FFFFFF' : '#B4232D'}
                                size={23}
                                source={PAYMENT_METHOD_ICONS[option.code]}
                              />
                            </View>
                            <View style={styles.methodText}>
                              <Text style={[styles.methodLabel, selected && styles.methodLabelSelected]}>
                                {option.label}
                              </Text>
                              <Text style={styles.methodDescription}>{option.description}</Text>
                            </View>
                            <Icon
                              color={selected ? '#B4232D' : '#879692'}
                              size={20}
                              source={selected ? 'radiobox-marked' : 'radiobox-blank'}
                            />
                          </Pressable>
                        );
                      })}
                    </View>
                  )}

                  {method === 'cash' ? (
                    <View style={styles.paymentForm}>
                      <TextInput
                        activeOutlineColor="#B4232D"
                        disabled={submitting}
                        error={receivedCents === null || cashShortfall > 0}
                        keyboardType="decimal-pad"
                        label="Efectivo recibido"
                        left={<TextInput.Affix text="S/" />}
                        mode="outlined"
                        onChangeText={(value) => {
                          setReceivedAmount(value);
                          setError('');
                        }}
                        outlineColor="#879692"
                        selectTextOnFocus
                        style={styles.amountInput}
                        value={receivedAmount}
                      />

                      <View style={styles.quickAmounts}>
                        <Pressable
                          accessibilityRole="button"
                          disabled={submitting}
                          onPress={() => {
                            setReceivedAmount(centsToDecimal(safeTotalCents));
                            setError('');
                          }}
                          style={[
                            styles.quickAmount,
                            receivedCents === safeTotalCents && styles.quickAmountSelected,
                          ]}
                        >
                          <Text style={[
                            styles.quickAmountText,
                            receivedCents === safeTotalCents && styles.quickAmountTextSelected,
                          ]}>
                            Exacto
                          </Text>
                        </Pressable>
                        {suggestedAmounts.map((amount) => {
                          const selected = receivedCents === amount;
                          return (
                            <Pressable
                              accessibilityRole="button"
                              disabled={submitting}
                              key={amount}
                              onPress={() => {
                                setReceivedAmount(centsToDecimal(amount));
                                setError('');
                              }}
                              style={[styles.quickAmount, selected && styles.quickAmountSelected]}
                            >
                              <Text style={[styles.quickAmountText, selected && styles.quickAmountTextSelected]}>
                                {formatMoneyFromCents(amount)}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      {receivedCents === null ? (
                        <Text style={styles.fieldError}>Ingresa un importe válido con hasta dos decimales.</Text>
                      ) : cashShortfall > 0 ? (
                        <Text style={styles.fieldError}>
                          El efectivo es insuficiente. Faltan {formatMoneyFromCents(cashShortfall)}.
                        </Text>
                      ) : null}

                      <View style={styles.cashSummary}>
                        <View style={styles.cashSummaryRow}>
                          <Text style={styles.cashSummaryLabel}>Total</Text>
                          <Text style={styles.cashSummaryValue}>{formatMoneyFromCents(safeTotalCents)}</Text>
                        </View>
                        <View style={styles.cashSummaryRow}>
                          <Text style={styles.cashSummaryLabel}>Recibido</Text>
                          <Text style={styles.cashSummaryValue}>
                            {receivedCents === null ? '—' : formatMoneyFromCents(receivedCents)}
                          </Text>
                        </View>
                        <View style={[styles.cashSummaryRow, styles.changeRow]}>
                          <Text style={styles.changeLabel}>Vuelto</Text>
                          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.changeValue}>
                            {changeCents === null ? '—' : formatMoneyFromCents(changeCents)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.paymentForm}>
                      <View style={styles.fixedAmount}>
                        <View>
                          <Text style={styles.fixedAmountLabel}>Importe registrado</Text>
                          <Text style={styles.fixedAmountHelp}>El pago debe coincidir con el total completo.</Text>
                        </View>
                        <Text style={styles.fixedAmountValue}>{formatMoneyFromCents(safeTotalCents)}</Text>
                      </View>

                      <TextInput
                        activeOutlineColor="#B4232D"
                        disabled={submitting}
                        label="Número de operación o referencia (opcional)"
                        mode="outlined"
                        onChangeText={(value) => {
                          setReference(value);
                          setError('');
                        }}
                        outlineColor="#879692"
                        style={styles.referenceInput}
                        value={reference}
                      />

                      <View style={styles.externalNote}>
                        <Icon color="#6E5A24" size={20} source="information-outline" />
                        <Text style={styles.externalNoteText}>
                          Confirma que el pago ya fue realizado externamente. Mayoreo solo guardará el registro.
                        </Text>
                      </View>
                    </View>
                  )}

                  {error ? (
                    <View accessibilityLiveRegion="polite" style={styles.errorBox}>
                      <Icon color="#8F1D2C" size={20} source="alert-circle-outline" />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : null}
                </View>
              </ScrollView>

              <View style={styles.footer}>
                <View style={styles.footerInner}>
                  <Button
                    buttonColor="#FF4D4D"
                    contentStyle={styles.primaryButtonContent}
                    disabled={submitting || !validPayment}
                    icon="lock-check-outline"
                    loading={submitting}
                    mode="contained"
                    onPress={() => void confirmCheckout()}
                  >
                    {submitting
                      ? 'Registrando venta…'
                      : `Confirmar cobro · ${formatMoneyFromCents(safeTotalCents)}`}
                  </Button>
                </View>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: '#F3F6F5' },
  header: { borderBottomWidth: 1, borderBottomColor: '#D7E0DE', backgroundColor: '#FFFFFF' },
  headerInner: { width: '100%', maxWidth: 1120, minHeight: 66, paddingHorizontal: 12, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButton: { margin: 0, backgroundColor: '#EAEFEE' },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { color: '#172423', fontSize: 18, fontWeight: '900' },
  headerSubtitle: { marginTop: 2, color: '#60706E', fontSize: 10 },
  content: { width: '100%', maxWidth: 1080, flexGrow: 1, alignSelf: 'center', padding: 14, paddingBottom: 28, gap: 14 },
  wideContent: { flexDirection: 'row', alignItems: 'flex-start', padding: 22, gap: 20 },
  summaryColumn: { gap: 12 },
  paymentColumn: { padding: 15, gap: 15, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 15, backgroundColor: '#FFFFFF' },
  wideColumn: { flex: 1, minWidth: 0 },
  totalCard: { overflow: 'hidden', padding: 20, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 16, backgroundColor: '#FFFFFF' },
  eyebrow: { color: '#60706E', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  total: { marginTop: 6, color: '#B4232D', fontSize: 42, lineHeight: 50, fontWeight: '900' },
  orderMeta: { marginTop: 18, paddingTop: 16, flexDirection: 'row', alignItems: 'center', gap: 11, borderTopWidth: 1, borderTopColor: '#D7E0DE' },
  orderMetaIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#FFE5E5' },
  orderMetaText: { flex: 1, minWidth: 0 },
  orderMetaTitle: { color: '#3D484D', fontSize: 13, fontWeight: '900' },
  orderMetaDetail: { marginTop: 3, color: '#60706E', fontSize: 10 },
  checkoutNote: { padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderRadius: 11, backgroundColor: '#EAEFEE' },
  checkoutNoteText: { flex: 1, color: '#60706E', fontSize: 10, lineHeight: 15 },
  sectionTitle: { color: '#172423', fontSize: 16, fontWeight: '900' },
  sectionHelp: { marginTop: 3, color: '#60706E', fontSize: 10, lineHeight: 15 },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodsLoading: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  methodsLoadingText: { color: '#60706E', fontSize: 10 },
  methodsError: { minHeight: 64, padding: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#FCE8EA' },
  methodCard: { minWidth: 190, minHeight: 66, flexGrow: 1, flexBasis: '47%', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 11, backgroundColor: '#FFFFFF' },
  methodCardSelected: { borderColor: '#B4232D', backgroundColor: '#FFE5E5' },
  methodCardPressed: { backgroundColor: '#F2F6F7' },
  disabledControl: { opacity: 0.58 },
  methodIcon: { width: 39, height: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#FFE5E5' },
  methodIconSelected: { backgroundColor: '#B4232D' },
  methodText: { flex: 1, minWidth: 0 },
  methodLabel: { color: '#4A555A', fontSize: 11, fontWeight: '900' },
  methodLabelSelected: { color: '#B4232D' },
  methodDescription: { marginTop: 2, color: '#60706E', fontSize: 8 },
  paymentForm: { gap: 10 },
  amountInput: { backgroundColor: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  quickAmounts: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  quickAmount: { minHeight: 36, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#879692', borderRadius: 18, backgroundColor: '#FFFFFF' },
  quickAmountSelected: { borderColor: '#B4232D', backgroundColor: '#FFE5E5' },
  quickAmountText: { color: '#5E696E', fontSize: 10, fontWeight: '800' },
  quickAmountTextSelected: { color: '#B4232D' },
  fieldError: { color: '#8F1D2C', fontSize: 10, fontWeight: '700' },
  cashSummary: { overflow: 'hidden', borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 12, backgroundColor: '#F8FAFA' },
  cashSummaryRow: { minHeight: 43, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: 1, borderBottomColor: '#D7E0DE' },
  cashSummaryLabel: { color: '#687479', fontSize: 10, fontWeight: '700' },
  cashSummaryValue: { color: '#172423', fontSize: 12, fontWeight: '900' },
  changeRow: { minHeight: 61, borderBottomWidth: 0, backgroundColor: '#E9F6F1' },
  changeLabel: { color: '#32735F', fontSize: 12, fontWeight: '900' },
  changeValue: { flex: 1, color: '#26745D', fontSize: 25, fontWeight: '900', textAlign: 'right' },
  fixedAmount: { padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 11, backgroundColor: '#EDF5F7' },
  fixedAmountLabel: { color: '#526167', fontSize: 10, fontWeight: '900' },
  fixedAmountHelp: { marginTop: 2, color: '#60706E', fontSize: 8 },
  fixedAmountValue: { color: '#B4232D', fontSize: 18, fontWeight: '900' },
  referenceInput: { backgroundColor: '#FFFFFF' },
  externalNote: { padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 10, backgroundColor: '#FBF5E7' },
  externalNoteText: { flex: 1, color: '#6E5A24', fontSize: 9, lineHeight: 14 },
  errorBox: { padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderColor: '#8F1D2C', borderRadius: 10, backgroundColor: '#FCE8EA' },
  errorText: { flex: 1, color: '#8F1D2C', fontSize: 10, lineHeight: 15, fontWeight: '700' },
  footer: { borderTopWidth: 1, borderTopColor: '#D7E0DE', backgroundColor: '#FFFFFF' },
  footerInner: { width: '100%', maxWidth: 1080, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'center' },
  primaryButtonContent: { minHeight: 48 },
  successScreen: { flex: 1 },
  successContent: { width: '100%', maxWidth: 560, flexGrow: 1, padding: 22, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  successIcon: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center', borderRadius: 48, backgroundColor: '#2E8B70' },
  successTitle: { marginTop: 20, color: '#303A3E', fontSize: 27, fontWeight: '900', textAlign: 'center' },
  successSubtitle: { maxWidth: 430, marginTop: 7, color: '#60706E', fontSize: 11, lineHeight: 17, textAlign: 'center' },
  successDocument: { marginTop: 21, paddingHorizontal: 22, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: '#E0F3EA' },
  successDocumentLabel: { color: '#60706E', fontSize: 9, fontWeight: '800' },
  successDocumentNumber: { marginTop: 3, color: '#247451', fontSize: 20, fontWeight: '900' },
  successSummary: { width: '100%', marginTop: 17, overflow: 'hidden', borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 14, backgroundColor: '#FFFFFF' },
  successRow: { minHeight: 50, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: '#D7E0DE' },
  successLabel: { color: '#60706E', fontSize: 10, fontWeight: '700' },
  successValue: { flex: 1, color: '#172423', fontSize: 13, fontWeight: '900', textAlign: 'right' },
  changeSuccess: { minHeight: 86, padding: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F6F0' },
  changeSuccessLabel: { color: '#32735F', fontSize: 10, fontWeight: '900' },
  changeSuccessValue: { width: '100%', marginTop: 4, color: '#26745D', fontSize: 31, fontWeight: '900', textAlign: 'center' },
  successFooter: { width: '100%', maxWidth: 560, paddingHorizontal: 18, paddingVertical: 10, alignSelf: 'center', borderTopWidth: 1, borderTopColor: '#D7E0DE' },
});
