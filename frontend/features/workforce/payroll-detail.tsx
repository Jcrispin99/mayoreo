import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Icon, Portal, ProgressBar, Text } from 'react-native-paper';
import { ModuleLayout } from '../../components/module/module-layout';
import { getVisibleMenu } from '../../config/menu';
import { api } from '../../lib/api';
import { formatBusinessDate } from '../../lib/date-time';
import { frequencyLabel, minutesLabel, percentageLabel } from './payroll-format';
import type { PayrollPeriod } from './workforce-types';

const ACCESS_MODULE = getVisibleMenu().find((module) => module.id === 'access');
const currency = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

function money(value: string | number) {
  return currency.format(Number(value));
}

function signedMoney(value: string | number) {
  const amount = Number(value);
  if (amount === 0) return money(0);
  return `${amount > 0 ? '+' : '−'} ${money(Math.abs(amount))}`;
}

function requestErrorMessage(error: any, fallback: string) {
  const validationErrors = error?.response?.data?.errors;
  const first = validationErrors ? Object.values(validationErrors).flat()[0] : null;
  return typeof first === 'string' ? first : error?.response?.data?.message ?? fallback;
}

export function PayrollDetail({ periodId }: { periodId: string }) {
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closeDialogVisible, setCloseDialogVisible] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/payroll-periods/${periodId}`);
      setPeriod(response.data.data);
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'No se pudo cargar la planilla.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [periodId]);

  async function run(action: 'recalculate' | 'close') {
    setSaving(true);
    setError('');
    try {
      const response = await api.post(`/payroll-periods/${periodId}/${action}`);
      setPeriod(response.data.data);
      setCloseDialogVisible(false);
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'No se pudo completar la operación.'));
      setCloseDialogVisible(false);
    } finally {
      setSaving(false);
    }
  }

  const summary = useMemo(() => {
    const lines = period?.lines ?? [];
    return lines.reduce((result, line) => ({
      payable: result.payable + Number(line.payable_amount),
      worked: result.worked + line.worked_minutes,
      required: result.required + line.required_minutes,
      incidents: result.incidents + line.incident_days,
    }), { payable: 0, worked: 0, required: 0, incidents: 0 });
  }, [period]);

  if (!ACCESS_MODULE) return null;
  return <ModuleLayout module={ACCESS_MODULE} selectedItemId="payroll">
    {loading ? <ActivityIndicator color="#B4232D" size="large" style={styles.loader} /> : <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Button compact icon="arrow-left" onPress={() => router.back()}>Volver</Button>
        {period?.status === 'open' ? <View style={styles.actions}>
          <Button compact disabled={saving} icon="calculator-variant-outline" loading={saving} onPress={() => void run('recalculate')}>Recalcular</Button>
          <Button buttonColor="#FF4D4D" compact disabled={saving || summary.incidents > 0} mode="contained" onPress={() => setCloseDialogVisible(true)}>Cerrar</Button>
        </View> : null}
      </View>

      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <Text style={styles.title}>Planilla {frequencyLabel(period?.pay_frequency ?? 'monthly').toLocaleLowerCase('es')}</Text>
          <Text style={styles.subtitle}>{period ? `${formatBusinessDate(period.starts_on)} al ${formatBusinessDate(period.ends_on)}` : ''}</Text>
        </View>
        <Text style={[styles.statusBadge, period?.status === 'closed' ? styles.statusClosed : styles.statusOpen]}>{period?.status === 'closed' ? 'CERRADA' : 'ABIERTA'}</Text>
      </View>

      {error ? <View style={styles.error}><Icon source="alert-circle-outline" color="#8F1D2C" size={20} /><Text style={styles.errorText}>{error}</Text></View> : null}
      {period?.status === 'open' && summary.incidents > 0 ? <View style={styles.incidentWarning}><Icon source="clock-alert-outline" color="#8F1D2C" size={21} /><Text style={styles.incidentText}>Hay {summary.incidents} {summary.incidents === 1 ? 'incidencia pendiente' : 'incidencias pendientes'}. Corrige o cierra las asistencias antes de cerrar la planilla.</Text></View> : null}

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}><Icon source="cash-check" color="#247451" size={23} /><Text style={styles.summaryLabel}>Total a pagar</Text><Text style={styles.summaryMoney}>{money(summary.payable)}</Text></View>
        <View style={styles.summaryCard}><Icon source="account-group-outline" color="#246B81" size={23} /><Text style={styles.summaryLabel}>Trabajadores</Text><Text style={styles.summaryValue}>{period?.lines?.length ?? 0}</Text></View>
        <View style={styles.summaryCard}><Icon source="timer-outline" color="#655021" size={23} /><Text style={styles.summaryLabel}>Horas registradas</Text><Text style={styles.summaryValue}>{minutesLabel(summary.worked)}</Text><Text style={styles.summaryHint}>Meta {minutesLabel(summary.required)}</Text></View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Detalle por trabajador</Text>
        <Text style={styles.sectionHelp}>El avance se obtiene de las entradas y salidas completas del periodo.</Text>
      </View>

      <View style={styles.lineList}>
        {(period?.lines ?? []).map((line) => {
          const progress = Math.min(1, Math.max(0, Number(line.completion_ratio)));
          const hasDeduction = Number(line.attendance_deduction) > 0;
          return <View key={line.id} style={styles.lineCard}>
            <View style={styles.lineHeader}>
              <View style={styles.employeeCopy}>
                <Text style={styles.employeeName}>{line.employee?.user.name ?? 'Trabajador'}</Text>
                <Text style={styles.employeeMeta}>{line.employee?.store?.name ?? 'Sin tienda'} · {frequencyLabel(line.pay_type)} · sueldo {money(line.rate_amount)}</Text>
              </View>
              <View style={styles.payCopy}><Text style={styles.payLabel}>A PAGAR</Text><Text style={styles.pay}>{money(line.payable_amount)}</Text></View>
            </View>

            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Cumplimiento de horas</Text>
              <Text style={[styles.progressPercent, progress >= 1 ? styles.complete : styles.incomplete]}>{percentageLabel(line.completion_ratio)}</Text>
            </View>
            <ProgressBar color={progress >= 1 ? '#247451' : '#E09B32'} progress={progress} style={styles.progress} />
            <View style={styles.hoursRow}>
              <Text style={styles.hoursText}>Registradas: <Text style={styles.hoursStrong}>{minutesLabel(line.worked_minutes)}</Text></Text>
              <Text style={styles.hoursText}>Meta: <Text style={styles.hoursStrong}>{minutesLabel(line.required_minutes)}</Text></Text>
            </View>

            <View style={styles.breakdown}>
              <View style={styles.breakdownItem}><Text style={styles.breakdownLabel}>Sueldo del periodo</Text><Text style={styles.breakdownValue}>{money(line.base_amount)}</Text></View>
              <View style={styles.breakdownItem}><Text style={styles.breakdownLabel}>Descuento por horas</Text><Text style={[styles.breakdownValue, hasDeduction && styles.deduction]}>− {money(line.attendance_deduction)}</Text></View>
              <View style={styles.breakdownItem}><Text style={styles.breakdownLabel}>Bonificación especial</Text><Text style={[styles.breakdownValue, Number(line.special_day_bonus) > 0 && styles.bonus]}>+ {money(line.special_day_bonus)}</Text></View>
              <View style={styles.breakdownItem}><Text style={styles.breakdownLabel}>Ajustes</Text><Text style={styles.breakdownValue}>{signedMoney(line.adjustments_amount)}</Text></View>
            </View>

            <View style={styles.lineFooter}>
              <Text style={styles.daysText}>{line.valid_days} de {line.scheduled_days} días de referencia con asistencia</Text>
              {line.incident_days > 0 ? <Text style={styles.lineIncident}>{line.incident_days} {line.incident_days === 1 ? 'incidencia' : 'incidencias'}</Text> : <Text style={styles.lineOk}>Sin incidencias</Text>}
            </View>
          </View>;
        })}
        {(period?.lines?.length ?? 0) === 0 ? <View style={styles.emptyCard}><Icon source="account-clock-outline" color="#60706E" size={44} /><Text style={styles.emptyTitle}>Sin trabajadores para esta planilla</Text><Text style={styles.emptyText}>Solo aparecen personas con una remuneración {frequencyLabel(period?.pay_frequency ?? 'monthly').toLocaleLowerCase('es')} vigente durante este periodo.</Text></View> : null}
      </View>
    </ScrollView>}

    <Portal>
      <Dialog dismissable={!saving} onDismiss={() => setCloseDialogVisible(false)} visible={closeDialogVisible}>
        <Dialog.Icon icon="lock-check-outline" />
        <Dialog.Title style={styles.dialogTitle}>Cerrar planilla</Dialog.Title>
        <Dialog.Content><Text style={styles.dialogText}>Se recalculará una última vez y los importes quedarán congelados. Después no podrás modificar este periodo.</Text></Dialog.Content>
        <Dialog.Actions>
          <Button disabled={saving} onPress={() => setCloseDialogVisible(false)}>Cancelar</Button>
          <Button buttonColor="#FF4D4D" loading={saving} mode="contained" onPress={() => void run('close')}>Cerrar planilla</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  </ModuleLayout>;
}

const styles = StyleSheet.create({
  loader: { flex: 1 }, content: { width: '100%', maxWidth: 1000, alignSelf: 'center', padding: 20, paddingBottom: 50 }, header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, actions: { flexDirection: 'row', alignItems: 'center', gap: 6 }, titleRow: { marginTop: 22, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }, titleCopy: { flex: 1 }, title: { color: '#172423', fontSize: 23, fontWeight: '900' }, subtitle: { marginTop: 6, color: '#60706E', fontSize: 12 }, statusBadge: { overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, fontSize: 9, fontWeight: '900' }, statusOpen: { color: '#246B81', backgroundColor: '#E1F2F6' }, statusClosed: { color: '#247451', backgroundColor: '#E0F3EA' }, error: { marginTop: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 8, backgroundColor: '#FCE8EA' }, errorText: { flex: 1, color: '#8F1D2C', fontSize: 11, lineHeight: 17 }, incidentWarning: { marginTop: 14, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: '#E9A6AC', borderRadius: 9, backgroundColor: '#FFF6F7' }, incidentText: { flex: 1, color: '#8F1D2C', fontSize: 11, lineHeight: 17 }, summaryGrid: { marginTop: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, summaryCard: { minWidth: 190, flex: 1, minHeight: 126, padding: 16, justifyContent: 'center', borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 12, backgroundColor: '#FFFFFF' }, summaryLabel: { marginTop: 8, color: '#60706E', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }, summaryMoney: { marginTop: 4, color: '#247451', fontSize: 20, fontWeight: '900' }, summaryValue: { marginTop: 4, color: '#172423', fontSize: 19, fontWeight: '900' }, summaryHint: { marginTop: 3, color: '#60706E', fontSize: 9 }, sectionHeader: { marginTop: 28 }, sectionTitle: { color: '#172423', fontSize: 17, fontWeight: '900' }, sectionHelp: { marginTop: 4, color: '#60706E', fontSize: 11, lineHeight: 17 }, lineList: { marginTop: 13, gap: 12 }, lineCard: { padding: 16, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 12, backgroundColor: '#FFFFFF' }, lineHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }, employeeCopy: { flex: 1 }, employeeName: { color: '#172423', fontSize: 14, fontWeight: '900' }, employeeMeta: { marginTop: 4, color: '#60706E', fontSize: 10, lineHeight: 15 }, payCopy: { alignItems: 'flex-end' }, payLabel: { color: '#60706E', fontSize: 8, fontWeight: '900' }, pay: { marginTop: 2, color: '#247451', fontSize: 17, fontWeight: '900' }, progressHeader: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, progressLabel: { color: '#60706E', fontSize: 10, fontWeight: '800' }, progressPercent: { fontSize: 11, fontWeight: '900' }, complete: { color: '#247451' }, incomplete: { color: '#9A6416' }, progress: { marginTop: 7, height: 7, borderRadius: 5, backgroundColor: '#EAEFEE' }, hoursRow: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }, hoursText: { color: '#60706E', fontSize: 10 }, hoursStrong: { color: '#172423', fontWeight: '800' }, breakdown: { marginTop: 16, paddingTop: 13, flexDirection: 'row', flexWrap: 'wrap', gap: 12, borderTopWidth: 1, borderTopColor: '#EAEFEE' }, breakdownItem: { minWidth: 135, flex: 1 }, breakdownLabel: { color: '#60706E', fontSize: 9 }, breakdownValue: { marginTop: 4, color: '#172423', fontSize: 11, fontWeight: '800' }, deduction: { color: '#8F1D2C' }, bonus: { color: '#247451' }, lineFooter: { marginTop: 14, paddingTop: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: '#EAEFEE' }, daysText: { color: '#60706E', fontSize: 9 }, lineIncident: { color: '#8F1D2C', fontSize: 9, fontWeight: '900' }, lineOk: { color: '#247451', fontSize: 9, fontWeight: '900' }, emptyCard: { padding: 36, alignItems: 'center', borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 12, backgroundColor: '#FFFFFF' }, emptyTitle: { marginTop: 10, color: '#172423', fontSize: 14, fontWeight: '900', textAlign: 'center' }, emptyText: { marginTop: 5, maxWidth: 420, color: '#60706E', fontSize: 11, lineHeight: 17, textAlign: 'center' }, dialogTitle: { textAlign: 'center' }, dialogText: { color: '#60706E', fontSize: 12, lineHeight: 18 },
});
