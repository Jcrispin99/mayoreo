import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Switch, Text, TextInput } from 'react-native-paper';
import { ModuleLayout } from '../../components/module/module-layout';
import { getVisibleMenu } from '../../config/menu';
import { api } from '../../lib/api';
import type { Supplier } from './purchase-types';

type SupplierFormProps = {
  supplierId?: string;
};

const PURCHASES_MODULE = getVisibleMenu().find((module) => module.id === 'purchases');

function requestErrorMessage(error: any) {
  const validationErrors = error?.response?.data?.errors;
  const firstValidationError = validationErrors ? Object.values(validationErrors).flat()[0] : null;
  if (typeof firstValidationError === 'string') return firstValidationError;
  return error?.response?.data?.message ?? 'No se pudo completar la operación.';
}

export function SupplierForm({ supplierId }: SupplierFormProps) {
  const editing = Boolean(supplierId);
  const [name, setName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [active, setActive] = useState(true);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supplierId) return;

    async function loadSupplier() {
      setLoading(true);
      setError('');
      try {
        const response = await api.get(`/suppliers/${supplierId}`);
        const supplier: Supplier = response.data.data;
        setName(supplier.name);
        setDocumentNumber(supplier.document_number ?? '');
        setPhone(supplier.phone ?? '');
        setEmail(supplier.email ?? '');
        setActive(supplier.is_active);
      } catch (requestError) {
        setError(requestErrorMessage(requestError));
      } finally {
        setLoading(false);
      }
    }

    void loadSupplier();
  }, [supplierId]);

  async function save() {
    if (!name.trim()) {
      setError('Completa el nombre del proveedor.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        document_number: documentNumber.trim() || null,
        phone: phone.trim() || null,
        email: email.trim().toLocaleLowerCase('es') || null,
        is_active: active,
      };

      if (editing) {
        await api.put(`/suppliers/${supplierId}`, payload);
      } else {
        await api.post('/suppliers', payload);
      }
      router.back();
    } catch (requestError) {
      setError(requestErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!supplierId) return;
    setSaving(true);
    setError('');
    try {
      await api.delete(`/suppliers/${supplierId}`);
      router.back();
    } catch (requestError) {
      setError(requestErrorMessage(requestError));
      setConfirmingDelete(false);
    } finally {
      setSaving(false);
    }
  }

  if (!PURCHASES_MODULE) return null;

  return (
    <ModuleLayout module={PURCHASES_MODULE} selectedItemId="suppliers">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        {loading ? (
          <ActivityIndicator color="#B4232D" size="large" style={styles.loader} />
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Button compact icon="arrow-left" mode="text" onPress={() => router.back()}>Volver</Button>
              <Button
                buttonColor="#FF4D4D"
                compact
                disabled={saving}
                loading={saving}
                mode="contained"
                onPress={() => void save()}
              >
                Guardar
              </Button>
            </View>

            <Text style={styles.title}>{editing ? 'Editar proveedor' : 'Nuevo proveedor'}</Text>
            <Text style={styles.subtitle}>Registra los datos que se utilizarán al crear una compra.</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.form}>
              <TextInput label="Nombre *" mode="flat" onChangeText={setName} style={styles.input} value={name} />
              <TextInput
                autoCapitalize="characters"
                label="Número de documento"
                maxLength={20}
                mode="flat"
                onChangeText={setDocumentNumber}
                style={styles.input}
                value={documentNumber}
              />
              <TextInput keyboardType="phone-pad" label="Teléfono" maxLength={30} mode="flat" onChangeText={setPhone} style={styles.input} value={phone} />
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                label="Correo electrónico"
                mode="flat"
                onChangeText={setEmail}
                style={styles.input}
                value={email}
              />
              <View style={styles.switchRow}>
                <View style={styles.switchCopy}>
                  <Text style={styles.switchText}>Proveedor activo</Text>
                  <Text style={styles.switchHelp}>Solo los proveedores activos aparecen al crear una compra.</Text>
                </View>
                <Switch onValueChange={setActive} value={active} />
              </View>
            </View>

            {editing ? (
              <View style={styles.dangerZone}>
                {confirmingDelete ? (
                  <View>
                    <Text style={styles.dangerTitle}>¿Eliminar {name}?</Text>
                    <Text style={styles.dangerText}>Si el proveedor tiene compras registradas, el sistema puede impedir su eliminación; en ese caso puedes desactivarlo.</Text>
                    <View style={styles.dangerActions}>
                      <Button disabled={saving} onPress={() => setConfirmingDelete(false)}>Cancelar</Button>
                      <Button buttonColor="#8F1D2C" loading={saving} mode="contained" onPress={() => void remove()} textColor="#FFFFFF">Eliminar</Button>
                    </View>
                  </View>
                ) : (
                  <Button icon="trash-can-outline" mode="text" onPress={() => setConfirmingDelete(true)} textColor="#8F1D2C">Eliminar el proveedor</Button>
                )}
              </View>
            ) : null}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </ModuleLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' },
  loader: { flex: 1 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { marginTop: 20, color: '#172423', fontSize: 24, fontWeight: '800' },
  subtitle: { marginTop: 6, color: '#60706E', fontSize: 12, lineHeight: 18 },
  error: { marginTop: 16, padding: 12, borderRadius: 8, color: '#8F1D2C', backgroundColor: '#FCE8EA' },
  form: { marginTop: 22, gap: 19 },
  input: { backgroundColor: 'transparent' },
  switchRow: { minHeight: 62, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#D7E0DE' },
  switchCopy: { flex: 1 },
  switchText: { color: '#172423', fontSize: 14, fontWeight: '700' },
  switchHelp: { marginTop: 3, color: '#60706E', fontSize: 10 },
  dangerZone: { marginTop: 42, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#D7E0DE', alignItems: 'flex-start' },
  dangerTitle: { color: '#8F1D2C', fontSize: 15, fontWeight: '800' },
  dangerText: { marginTop: 7, color: '#60706E', fontSize: 11, lineHeight: 17 },
  dangerActions: { marginTop: 12, flexDirection: 'row', gap: 8 },
});
