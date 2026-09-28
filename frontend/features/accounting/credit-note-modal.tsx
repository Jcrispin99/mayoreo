import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Checkbox,
  Icon,
  Menu,
  Text,
  TextInput,
} from 'react-native-paper';
import { api } from '../../lib/api';
import {
  CREDIT_NOTE_REASONS,
  type AccountingFiscalDocument,
  type AccountingSale,
} from './accounting-types';

function money(value: number) {
  return `S/ ${value.toFixed(2)}`;
}

function requestErrorMessage(requestError: unknown) {
  if (!axios.isAxiosError(requestError)) {
    return 'No se pudo emitir la nota de crédito.';
  }

  const responseData = requestError.response?.data as {
    errors?: Record<string, string | string[]>;
    message?: string;
  } | undefined;
  const firstValidationError = responseData?.errors
    ? Object.values(responseData.errors).flat()[0]
    : null;

  if (typeof firstValidationError === 'string') return firstValidationError;
  return responseData?.message ?? 'No se pudo emitir la nota de crédito.';
}

type SelectedItem = {
  saleItemId: number;
  checked: boolean;
  quantity: string;
};

type CreditNoteModalProps = {
  document: AccountingFiscalDocument;
  onClose: () => void;
  onIssued: (creditNote: AccountingFiscalDocument) => void;
  sale: AccountingSale;
  visible: boolean;
};

export function CreditNoteModal({
  document,
  onClose,
  onIssued,
  sale,
  visible,
}: CreditNoteModalProps) {
  const [reasonCode, setReasonCode] = useState('06');
  const [reasonMenuVisible, setReasonMenuVisible] = useState(false);
  const [reasonDescription, setReasonDescription] = useState('');
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [issued, setIssued] = useState<AccountingFiscalDocument | null>(null);

  useEffect(() => {
    if (!visible) return;
    setReasonCode('06');
    setReasonDescription('');
    setError('');
    setIssued(null);
    setItems(sale.items.map((item) => ({
      saleItemId: item.id,
      checked: true,
      quantity: item.quantity,
    })));
  }, [sale.items, visible]);

  const selectedReason = CREDIT_NOTE_REASONS.find((reason) => reason.code === reasonCode);
  const checkedItems = items.filter((item) => item.checked);
  const total = useMemo(() => checkedItems.reduce((sum, selected) => {
    const saleItem = sale.items.find((item) => item.id === selected.saleItemId);
    if (!saleItem) return sum;
    const quantity = Number(selected.quantity || '0');
    const unitPrice = Number(saleItem.unit_price);
    return sum + quantity * unitPrice;
  }, 0), [checkedItems, sale.items]);

  function toggleItem(saleItemId: number) {
    setItems((current) => current.map((item) => (
      item.saleItemId === saleItemId ? { ...item, checked: !item.checked } : item
    )));
  }

  function updateQuantity(saleItemId: number, quantity: string) {
    setItems((current) => current.map((item) => (
      item.saleItemId === saleItemId ? { ...item, quantity } : item
    )));
  }

  async function submit() {
    const invalidQuantity = checkedItems.some((selected) => {
      const saleItem = sale.items.find((item) => item.id === selected.saleItemId);
      const quantity = Number(selected.quantity);
      return !saleItem || !Number.isFinite(quantity) || quantity <= 0
        || quantity > Number(saleItem.quantity);
    });

    if (checkedItems.length === 0) {
      setError('Selecciona al menos un producto para la devolución.');
      return;
    }
    if (invalidQuantity) {
      setError('Revisa las cantidades: no pueden ser mayores a lo vendido.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await api.post(`/fiscal-documents/${document.id}/credit-note`, {
        reason_code: reasonCode,
        reason_description: reasonDescription.trim() || null,
        items: checkedItems.map((selected) => ({
          sale_item_id: selected.saleItemId,
          quantity: selected.quantity.trim(),
        })),
      });
      const creditNote = response.data.data as AccountingFiscalDocument;
      setIssued(creditNote);
      onIssued(creditNote);
    } catch (requestError) {
      setError(requestErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" visible={visible}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Button compact icon="arrow-left" mode="text" onPress={onClose}>
            Cerrar
          </Button>
          <Text style={styles.headerTitle}>Nota de crédito</Text>
          <View style={styles.headerSpacer} />
        </View>

        {issued ? (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.successIcon}>
              <Icon color="#FFFFFF" size={48} source="check-bold" />
            </View>
            <Text style={styles.successTitle}>{issued.full_number}</Text>
            <Text style={styles.successSubtitle}>
              Referencia a {document.full_number} · motivo: {selectedReason?.label ?? reasonCode}
            </Text>
            <View style={styles.successCard}>
              <Text style={styles.successLabel}>Estado en SUNAT</Text>
              <Text style={styles.successValue}>
                {issued.sunat.status === 'pending'
                  ? 'En cola, se enviará en segundo plano'
                  : issued.sunat.status}
              </Text>
              {issued.sunat.cdr_description ? (
                <Text style={styles.successNote}>{issued.sunat.cdr_description}</Text>
              ) : null}
              {issued.sunat.error_message ? (
                <Text style={styles.successError}>{issued.sunat.error_message}</Text>
              ) : null}
            </View>
            <Button mode="contained" onPress={onClose} style={styles.doneButton}>
              Listo
            </Button>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.subtitle}>
              Se emitirá referenciando {document.full_number}. El stock de los productos seleccionados
              vuelve al almacén.
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Text style={styles.fieldLabel}>Motivo (Catálogo 09 SUNAT) *</Text>
            <Menu
              anchor={(
                <Pressable onPress={() => setReasonMenuVisible(true)} style={styles.selector}>
                  <Text numberOfLines={1} style={styles.selectorText}>
                    {selectedReason ? `${selectedReason.code} · ${selectedReason.label}` : 'Seleccionar motivo'}
                  </Text>
                  <Icon color="#60706E" size={21} source="chevron-down" />
                </Pressable>
              )}
              onDismiss={() => setReasonMenuVisible(false)}
              visible={reasonMenuVisible}
            >
              <ScrollView style={styles.reasonMenuScroll}>
                {CREDIT_NOTE_REASONS.map((reason) => (
                  <Menu.Item
                    key={reason.code}
                    onPress={() => {
                      setReasonCode(reason.code);
                      setReasonMenuVisible(false);
                    }}
                    title={`${reason.code} · ${reason.label}`}
                  />
                ))}
              </ScrollView>
            </Menu>

            <TextInput
              label="Detalle del motivo (opcional)"
              maxLength={255}
              mode="flat"
              onChangeText={setReasonDescription}
              style={styles.input}
              value={reasonDescription}
            />

            <Text style={styles.sectionTitle}>Productos a devolver</Text>
            <View style={styles.items}>
              {sale.items.map((saleItem) => {
                const selected = items.find((item) => item.saleItemId === saleItem.id);
                if (!selected) return null;

                return (
                  <View key={saleItem.id} style={styles.itemRow}>
                    <Checkbox
                      onPress={() => toggleItem(saleItem.id)}
                      status={selected.checked ? 'checked' : 'unchecked'}
                    />
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{saleItem.product?.name ?? `Producto #${saleItem.product_id}`}</Text>
                      <Text style={styles.itemMeta}>
                        Vendido: {Number(saleItem.quantity).toLocaleString('es-PE')} · {money(Number(saleItem.unit_price))} c/u
                      </Text>
                      {selected.checked ? (
                        <TextInput
                          dense
                          keyboardType="decimal-pad"
                          label="Cantidad a devolver"
                          mode="flat"
                          onChangeText={(value) => updateQuantity(saleItem.id, value)}
                          style={styles.quantityInput}
                          value={selected.quantity}
                        />
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total a acreditar</Text>
              <Text style={styles.totalValue}>{money(total)}</Text>
            </View>

            <Button
              buttonColor="#B4232D"
              disabled={submitting}
              loading={submitting}
              mode="contained"
              onPress={() => void submit()}
              style={styles.submitButton}
            >
              Emitir nota de crédito
            </Button>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' },
  header: { paddingTop: 12, paddingHorizontal: 8, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#E1E8E6' },
  headerTitle: { color: '#172423', fontSize: 14, fontWeight: '900' },
  headerSpacer: { width: 72 },
  content: { width: '100%', maxWidth: 800, alignSelf: 'center', padding: 20, paddingBottom: 60 },
  subtitle: { color: '#60706E', fontSize: 12, lineHeight: 18 },
  error: { marginTop: 16, padding: 12, borderRadius: 9, color: '#8F1D2C', backgroundColor: '#FCE8EA', fontSize: 11, lineHeight: 17 },
  fieldLabel: { marginTop: 22, marginBottom: 8, color: '#60706E', fontSize: 10, fontWeight: '700' },
  selector: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#879692' },
  selectorText: { flex: 1, color: '#172423', fontSize: 13 },
  reasonMenuScroll: { maxHeight: 360 },
  input: { marginTop: 18, backgroundColor: 'transparent' },
  sectionTitle: { marginTop: 28, color: '#172423', fontSize: 16, fontWeight: '900' },
  items: { marginTop: 12, gap: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 10, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 12, backgroundColor: '#FFFFFF' },
  itemInfo: { flex: 1, paddingTop: 8 },
  itemName: { color: '#172423', fontSize: 13, fontWeight: '800' },
  itemMeta: { marginTop: 3, color: '#60706E', fontSize: 10 },
  quantityInput: { marginTop: 8, backgroundColor: 'transparent' },
  totalCard: { marginTop: 24, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderWidth: 1, borderColor: '#C9DED5', borderRadius: 14, backgroundColor: '#EDF6F2' },
  totalLabel: { color: '#3E5D54', fontSize: 13, fontWeight: '900' },
  totalValue: { color: '#23634F', fontSize: 22, fontWeight: '900' },
  submitButton: { marginTop: 24 },
  successIcon: { marginTop: 40, alignSelf: 'center', width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2E9E6F' },
  successTitle: { marginTop: 18, textAlign: 'center', color: '#172423', fontSize: 22, fontWeight: '900' },
  successSubtitle: { marginTop: 6, textAlign: 'center', color: '#60706E', fontSize: 11 },
  successCard: { marginTop: 24, padding: 16, gap: 6, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 13, backgroundColor: '#FFFFFF' },
  successLabel: { color: '#60706E', fontSize: 10, fontWeight: '700' },
  successValue: { color: '#172423', fontSize: 14, fontWeight: '800' },
  successNote: { color: '#3E5D54', fontSize: 11 },
  successError: { color: '#8F1D2C', fontSize: 11 },
  doneButton: { marginTop: 32 },
});
