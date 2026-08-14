import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Button, DataTable, Text } from 'react-native-paper';
import { ModuleLayout } from '../../components/module/module-layout';
import { getVisibleMenu } from '../../config/menu';
import { api } from '../../lib/api';
import type { PayrollPeriod } from './workforce-types';

const ACCESS_MODULE = getVisibleMenu().find((module) => module.id === 'access');
const money = (value: string) => `S/ ${Number(value).toFixed(2)}`;
const hours = (minutes: number) => `${Math.floor(minutes / 60)} h ${minutes % 60} min`;

export function PayrollDetail({ periodId }: { periodId: string }) {
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { const response = await api.get(`/payroll-periods/${periodId}`); setPeriod(response.data.data); }
    catch (requestError: any) { setError(requestError?.response?.data?.message ?? 'No se pudo cargar la planilla.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [periodId]);

  async function run(action: 'recalculate' | 'close') {
    setSaving(true); setError('');
    try { const response = await api.post(`/payroll-periods/${periodId}/${action}`); setPeriod(response.data.data); }
    catch (requestError: any) { setError(requestError?.response?.data?.message ?? 'No se pudo completar la operación.'); }
    finally { setSaving(false); }
  }

  if (!ACCESS_MODULE) return null;
  return <ModuleLayout module={ACCESS_MODULE} selectedItemId="payroll">
    {loading ? <ActivityIndicator color="#B4232D" size="large" style={styles.loader} /> : <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}><Button icon="arrow-left" onPress={() => router.back()}>Volver</Button><View style={styles.actions}>{period?.status === 'open' ? <><Button disabled={saving} icon="calculator-variant-outline" onPress={() => void run('recalculate')}>Recalcular</Button><Button buttonColor="#FF4D4D" disabled={saving} mode="contained" onPress={() => void run('close')}>Cerrar planilla</Button></> : null}</View></View>
      <Text style={styles.title}>Planilla {period?.starts_on} — {period?.ends_on}</Text>
      <Text style={styles.subtitle}>{period?.status === 'closed' ? 'Periodo cerrado y congelado.' : 'Importes estimados antes de cerrar el periodo.'}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.tableCard}>
        <DataTable>
          <DataTable.Header><DataTable.Title style={styles.employee}>Trabajador</DataTable.Title><DataTable.Title numeric>Días</DataTable.Title><DataTable.Title numeric>Horas</DataTable.Title><DataTable.Title numeric>Pago</DataTable.Title></DataTable.Header>
          {(period?.lines ?? []).map((line) => <DataTable.Row key={line.id}>
            <DataTable.Cell style={styles.employee}><View><Text style={styles.employeeName}>{line.employee?.user.name ?? 'Trabajador'}</Text><Text style={styles.lineMeta}>{line.pay_type === 'monthly' ? `Mensual · divisor ${line.monthly_divisor}` : 'Diario'} · {line.incident_days} incidencias</Text><Text style={styles.breakdown}>Base {money(line.base_amount)} · Descuento −{money(line.attendance_deduction)} · Recompensa +{money(line.special_day_bonus)}</Text></View></DataTable.Cell>
            <DataTable.Cell numeric>{line.valid_days}/{line.scheduled_days}</DataTable.Cell><DataTable.Cell numeric>{hours(line.worked_minutes)}</DataTable.Cell><DataTable.Cell numeric><Text style={styles.pay}>{money(line.payable_amount)}</Text></DataTable.Cell>
          </DataTable.Row>)}
        </DataTable>
        {(period?.lines?.length ?? 0) === 0 ? <Text style={styles.empty}>No hay trabajadores elegibles en este periodo.</Text> : null}
      </View>
    </ScrollView>}
  </ModuleLayout>;
}

const styles = StyleSheet.create({
  loader: { flex: 1 }, content: { width: '100%', maxWidth: 1000, alignSelf: 'center', padding: 20, paddingBottom: 50 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, actions: { flexDirection: 'row', gap: 8 }, title: { marginTop: 22, color: '#172423', fontSize: 23, fontWeight: '900' }, subtitle: { marginTop: 6, color: '#60706E', fontSize: 12 }, error: { marginTop: 14, padding: 12, color: '#8F1D2C', backgroundColor: '#FCE8EA' }, tableCard: { marginTop: 22, overflow: 'hidden', borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 12, backgroundColor: '#FFFFFF' }, employee: { flex: 2 }, employeeName: { color: '#172423', fontWeight: '800' }, lineMeta: { marginTop: 3, color: '#60706E', fontSize: 9 }, breakdown: { marginTop: 3, color: '#246B81', fontSize: 8 }, pay: { color: '#247451', fontWeight: '900' }, empty: { padding: 30, color: '#60706E', textAlign: 'center' },
});
