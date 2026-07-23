import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Icon, Text, TextInput } from 'react-native-paper';
import { ModuleLayout } from '../../components/module/module-layout';
import { getVisibleMenu } from '../../config/menu';
import { api } from '../../lib/api';
import type { CashRegister, CashRegisterSession } from './pos-types';

const POS_MODULE = getVisibleMenu().find((module) => module.id === 'pos');

function requestErrorMessage(error: any) {
  const validationErrors = error?.response?.data?.errors;
  const firstValidationError = validationErrors ? Object.values(validationErrors).flat()[0] : null;
  if (typeof firstValidationError === 'string') return firstValidationError;
  return error?.response?.data?.message ?? 'No se pudo aperturar la caja.';
}

export function CashSessionOpenForm({ cashRegisterId }: { cashRegisterId: string }) {
  const [cashRegister, setCashRegister] = useState<CashRegister | null>(null);
  const [openingAmount, setOpeningAmount] = useState('0.00');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadCashRegister() {
      setLoading(true);
      setError('');
      try {
        const [registerResponse, sessionResponse] = await Promise.all([
          api.get(`/cash-registers/${cashRegisterId}`),
          api.get('/cash-register-sessions', {
            params: { cash_register_id: cashRegisterId, status: 'open' },
          }),
        ]);
        const activeSession: CashRegisterSession | undefined = sessionResponse.data.data?.[0];
        if (activeSession) {
          router.replace({
            pathname: '/pos/terminal/[cashSessionId]',
            params: { cashSessionId: String(activeSession.id) },
          } as Href);
          return;
        }
        setCashRegister(registerResponse.data.data);
      } catch (requestError) {
        setError(requestErrorMessage(requestError));
      } finally {
        setLoading(false);
      }
    }

    void loadCashRegister();
  }, [cashRegisterId]);

  async function openCashRegister() {
    if (!cashRegister) return;
    if (!openingAmount.trim() || Number(openingAmount) < 0) {
      setError('Ingresa un monto de apertura válido.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const response = await api.post(`/cash-registers/${cashRegister.id}/sessions`, {
        opening_amount: Number(openingAmount),
      });
      router.replace({
        pathname: '/pos/terminal/[cashSessionId]',
        params: { cashSessionId: String(response.data.data.id) },
      } as Href);
    } catch (requestError) {
      setError(requestErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  if (!POS_MODULE) return null;

  return (
    <ModuleLayout module={POS_MODULE} selectedItemId="cash-registers">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        {loading ? <ActivityIndicator color="#28738A" size="large" style={styles.loader} /> : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Button compact icon="arrow-left" mode="text" onPress={() => router.back()}>Volver</Button>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {cashRegister ? (
              <View style={styles.card}>
                <View style={styles.cashRegisterHeader}>
                  <View style={styles.cashRegisterIcon}>
                    <Icon color="#28738A" size={27} source="cash-register" />
                  </View>
                  <View style={styles.cashRegisterIdentity}>
                    <Text style={styles.eyebrow}>APERTURA DE CAJA</Text>
                    <Text style={styles.title}>{cashRegister.code}</Text>
                    <Text style={styles.cashRegisterName}>{cashRegister.name}</Text>
                  </View>
                </View>

                <View style={styles.locationLine}>
                  <Icon color="#827B85" size={17} source="map-marker-outline" />
                  <Text style={styles.locationText}>
                    {cashRegister.store.name} · {cashRegister.warehouse.name}
                  </Text>
                </View>

                <View style={styles.amountSection}>
                  <Text style={styles.amountTitle}>Monto de apertura</Text>
                  <Text style={styles.amountHelp}>Ingresa el efectivo físico con el que inicia esta caja.</Text>
                  <TextInput
                    activeOutlineColor="#28738A"
                    autoFocus
                    keyboardType="decimal-pad"
                    label="Efectivo inicial *"
                    left={<TextInput.Affix text="S/" />}
                    mode="outlined"
                    onChangeText={setOpeningAmount}
                    outlineColor="#D8D1DA"
                    style={styles.amountInput}
                    value={openingAmount}
                  />
                </View>

                <Button
                  buttonColor="#28738A"
                  disabled={saving}
                  icon="lock-open-variant-outline"
                  loading={saving}
                  mode="contained"
                  onPress={() => void openCashRegister()}
                  style={styles.openButton}
                >
                  Aperturar e ingresar al POS
                </Button>
              </View>
            ) : null}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </ModuleLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F5F8' },
  loader: { flex: 1 },
  content: { width: '100%', maxWidth: 560, flexGrow: 1, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  header: { marginBottom: 18, alignItems: 'flex-start' },
  error: { marginBottom: 14, padding: 12, borderRadius: 10, color: '#9B324A', backgroundColor: '#FBE8ED', fontSize: 11, fontWeight: '700' },
  card: { padding: 20, borderWidth: 1, borderColor: '#E2DCE4', borderRadius: 16, backgroundColor: '#FFFFFF', gap: 18 },
  cashRegisterHeader: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  cashRegisterIcon: { width: 54, height: 54, borderRadius: 13, backgroundColor: '#E6F2F5', alignItems: 'center', justifyContent: 'center' },
  cashRegisterIdentity: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#28738A', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  title: { marginTop: 3, color: '#302A33', fontSize: 25, fontWeight: '900' },
  cashRegisterName: { marginTop: 2, color: '#77717A', fontSize: 11 },
  locationLine: { padding: 11, borderRadius: 9, backgroundColor: '#F5F3F6', flexDirection: 'row', alignItems: 'center', gap: 7 },
  locationText: { flex: 1, color: '#716A74', fontSize: 10 },
  amountSection: { gap: 5 },
  amountTitle: { color: '#3B343D', fontSize: 14, fontWeight: '900' },
  amountHelp: { marginBottom: 8, color: '#89828C', fontSize: 10, lineHeight: 15 },
  amountInput: { backgroundColor: '#FFFFFF' },
  openButton: { marginTop: 2 },
});
