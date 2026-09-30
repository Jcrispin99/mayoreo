import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Icon, Text } from 'react-native-paper';
import { api } from '../../lib/api';
import type { DocumentSeries } from '../pos/pos-types';
import type { AccountingFiscalDocument, AccountingSale } from './accounting-types';

const DOCUMENT_LABELS = {
  receipt: 'Boleta',
  invoice: 'Factura',
} as const;

function requestErrorMessage(requestError: unknown) {
  if (!axios.isAxiosError(requestError)) {
    return 'No se pudo emitir el comprobante.';
  }

  const responseData = requestError.response?.data as {
    errors?: Record<string, string | string[]>;
    message?: string;
  } | undefined;
  const firstValidationError = responseData?.errors
    ? Object.values(responseData.errors).flat()[0]
    : null;

  if (typeof firstValidationError === 'string') return firstValidationError;
  return responseData?.message ?? 'No se pudo emitir el comprobante.';
}

type FiscalDocumentModalProps = {
  onClose: () => void;
  onIssued: (document: AccountingFiscalDocument) => void;
  sale: AccountingSale;
  sourceDocument: AccountingFiscalDocument;
  visible: boolean;
};

export function FiscalDocumentModal({
  onClose,
  onIssued,
  sale,
  sourceDocument,
  visible,
}: FiscalDocumentModalProps) {
  const [series, setSeries] = useState<DocumentSeries[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [issued, setIssued] = useState<AccountingFiscalDocument | null>(null);

  useEffect(() => {
    if (!visible) return;

    async function loadSeries() {
      setLoading(true);
      setError('');
      setIssued(null);
      setSelectedSeriesId(null);

      try {
        const issuerFilter = sourceDocument.fiscal_issuer_id === null
          ? ''
          : `&fiscal_issuer_id=${sourceDocument.fiscal_issuer_id}`;
        const response = await api.get(`/document-series?is_active=true&purpose=operational${issuerFilter}`);
        const available = (response.data.data ?? []).filter(
          (item: DocumentSeries) => ['receipt', 'invoice'].includes(item.document_type),
        ) as DocumentSeries[];
        setSeries(available);
        setSelectedSeriesId(available[0]?.id ?? null);
      } catch (requestError) {
        setError(requestErrorMessage(requestError));
      } finally {
        setLoading(false);
      }
    }

    void loadSeries();
  }, [sourceDocument.fiscal_issuer_id, visible]);

  const selectedSeries = series.find((item) => item.id === selectedSeriesId) ?? null;
  const customerDocument = sale.customer_document?.trim() ?? '';
  const eligibilityError = useMemo(() => {
    if (selectedSeries?.document_type === 'invoice'
      && (!sale.customer_name?.trim() || !/^\d{11}$/.test(customerDocument))) {
      return 'La factura requiere un cliente con razón social y RUC de 11 dígitos.';
    }
    if (selectedSeries?.document_type === 'receipt'
      && customerDocument !== ''
      && !/^(?:\d{8}|\d{11})$/.test(customerDocument)) {
      return 'La boleta admite un cliente sin documento, con DNI de 8 dígitos o RUC de 11 dígitos.';
    }
    return '';
  }, [customerDocument, sale.customer_name, selectedSeries?.document_type]);

  async function submit() {
    if (!selectedSeries || eligibilityError) {
      setError(eligibilityError || 'Selecciona una serie de boleta o factura.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await api.post(`/sales/${sale.id}/fiscal-documents`, {
        document_type: selectedSeries.document_type,
        document_series_id: selectedSeries.id,
      });
      const document = response.data.data as AccountingFiscalDocument;
      setIssued(document);
      onIssued(document);
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
          <Button compact icon="arrow-left" mode="text" onPress={onClose}>Cerrar</Button>
          <Text style={styles.headerTitle}>Emitir comprobante</Text>
          <View style={styles.headerSpacer} />
        </View>

        {issued ? (
          <ScrollView contentContainerStyle={styles.successContent}>
            <View style={styles.successIcon}>
              <Icon color="#FFFFFF" size={48} source="check-bold" />
            </View>
            <Text style={styles.successTitle}>{issued.full_number}</Text>
            <Text style={styles.subtitle}>
              {DOCUMENT_LABELS[issued.document_type as 'receipt' | 'invoice']} emitida desde {sourceDocument.full_number}.
              La venta, el pago y el stock no se duplicaron.
            </Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Estado en SUNAT</Text>
              <Text style={styles.infoValue}>
                {issued.sunat.status === 'pending'
                  ? 'En cola, se enviará en segundo plano'
                  : issued.sunat.status}
              </Text>
            </View>
            <Button mode="contained" onPress={onClose} style={styles.submitButton}>Listo</Button>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>Convertir {sourceDocument.full_number}</Text>
            <Text style={styles.subtitle}>
              Elige la serie fiscal. Esta acción consume el siguiente correlativo y no se puede repetir.
            </Text>

            {loading ? <ActivityIndicator color="#B4232D" style={styles.loader} /> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            {!loading && series.length === 0 ? (
              <View style={styles.emptyCard}>
                <Icon color="#60706E" size={36} source="file-document-alert-outline" />
                <Text style={styles.emptyTitle}>No hay series fiscales activas</Text>
                <Text style={styles.emptyText}>
                  Crea una serie de boleta o factura en POS → Series y correlativos.
                </Text>
              </View>
            ) : (
              <View style={styles.seriesList}>
                {series.map((item) => {
                  const selected = item.id === selectedSeriesId;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      key={item.id}
                      onPress={() => {
                        setSelectedSeriesId(item.id);
                        setError('');
                      }}
                      style={[styles.seriesCard, selected && styles.seriesCardSelected]}
                    >
                      <View style={[styles.seriesIcon, !selected && styles.seriesIconIdle]}>
                        <Icon color={selected ? '#FFFFFF' : '#B4232D'} size={24} source="receipt-text-outline" />
                      </View>
                      <View style={styles.seriesInfo}>
                        <Text style={styles.seriesType}>
                          {DOCUMENT_LABELS[item.document_type as 'receipt' | 'invoice']}
                        </Text>
                        <Text style={styles.seriesCode}>
                          {item.series_code} · próximo {item.next_number}
                        </Text>
                      </View>
                      <Icon color={selected ? '#B4232D' : '#91A09D'} size={24} source={selected ? 'radiobox-marked' : 'radiobox-blank'} />
                    </Pressable>
                  );
                })}
              </View>
            )}

            <View style={styles.customerCard}>
              <Text style={styles.infoLabel}>Cliente del comprobante</Text>
              <Text style={styles.customerName}>{sale.customer_name || 'Cliente de mostrador'}</Text>
              <Text style={styles.customerDocument}>{customerDocument || 'Sin documento'}</Text>
            </View>
            {eligibilityError ? <Text style={styles.warning}>{eligibilityError}</Text> : null}

            <Button
              buttonColor="#B4232D"
              disabled={!selectedSeries || Boolean(eligibilityError) || submitting}
              loading={submitting}
              mode="contained"
              onPress={() => void submit()}
              style={styles.submitButton}
            >
              Emitir {selectedSeries ? DOCUMENT_LABELS[selectedSeries.document_type as 'receipt' | 'invoice'].toLowerCase() : 'comprobante'}
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
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 20, paddingBottom: 60 },
  successContent: { flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', padding: 28 },
  title: { color: '#172423', fontSize: 24, fontWeight: '900' },
  subtitle: { marginTop: 8, textAlign: 'center', color: '#60706E', fontSize: 12, lineHeight: 19 },
  loader: { marginTop: 40 },
  error: { marginTop: 16, padding: 12, borderRadius: 9, color: '#8F1D2C', backgroundColor: '#FCE8EA', fontSize: 11, lineHeight: 17 },
  seriesList: { marginTop: 24, gap: 10 },
  seriesCard: { minHeight: 78, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 13, backgroundColor: '#FFFFFF' },
  seriesCardSelected: { borderWidth: 2, borderColor: '#B4232D', backgroundColor: '#FFF7F7' },
  seriesIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: '#B4232D' },
  seriesIconIdle: { backgroundColor: '#FCE8EA' },
  seriesInfo: { flex: 1 },
  seriesType: { color: '#172423', fontSize: 14, fontWeight: '900' },
  seriesCode: { marginTop: 3, color: '#60706E', fontSize: 11 },
  customerCard: { marginTop: 24, padding: 16, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 13, backgroundColor: '#FFFFFF' },
  infoCard: { width: '100%', marginTop: 24, padding: 18, borderWidth: 1, borderColor: '#C9DED5', borderRadius: 13, backgroundColor: '#EDF6F2' },
  infoLabel: { color: '#60706E', fontSize: 10, fontWeight: '700' },
  infoValue: { marginTop: 6, color: '#23634F', fontSize: 13, fontWeight: '900' },
  customerName: { marginTop: 6, color: '#172423', fontSize: 13, fontWeight: '900' },
  customerDocument: { marginTop: 3, color: '#60706E', fontSize: 11 },
  warning: { marginTop: 12, color: '#8F1D2C', fontSize: 11, lineHeight: 17 },
  submitButton: { width: '100%', marginTop: 28 },
  emptyCard: { marginTop: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 13, backgroundColor: '#FFFFFF' },
  emptyTitle: { marginTop: 10, color: '#172423', fontSize: 14, fontWeight: '900' },
  emptyText: { marginTop: 5, textAlign: 'center', color: '#60706E', fontSize: 11, lineHeight: 17 },
  successIcon: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center', borderRadius: 44, backgroundColor: '#247451' },
  successTitle: { marginTop: 20, color: '#172423', fontSize: 25, fontWeight: '900' },
});
