import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Switch, Text, TextInput } from 'react-native-paper';
import { ModuleLayout } from '../../components/module/module-layout';
import { getVisibleMenu } from '../../config/menu';
import { api } from '../../lib/api';
import type { Customer } from './customer-types';

type CustomerFormProps = {
  customerId?: string;
};

const CUSTOMERS_MODULE = getVisibleMenu().find((module) => module.id === 'customers');

function requestErrorMessage(error: any) {
  const validationErrors = error?.response?.data?.errors;
  const firstValidationError = validationErrors
    ? Object.values(validationErrors).flat()[0]
    : null;

  if (typeof firstValidationError === 'string') return firstValidationError;
  return error?.response?.data?.message ?? 'No se pudo completar la operación.';
}

export function CustomerForm({ customerId }: CustomerFormProps) {
  const editing = Boolean(customerId);
  const [name, setName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [active, setActive] = useState(true);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!customerId) return;

    async function loadCustomer() {
      setLoading(true);
      setError('');

      try {
        const response = await api.get(`/customers/${customerId}`);
        const customer = response.data.data as Customer;
        setName(customer.name);
        setDocumentNumber(customer.document_number ?? '');
        setPhone(customer.phone ?? '');
        setEmail(customer.email ?? '');
        setAddress(customer.address ?? '');
        setActive(customer.is_active);
      } catch (requestError) {
        setError(requestErrorMessage(requestError));
      } finally {
        setLoading(false);
      }
    }

    void loadCustomer();
  }, [customerId]);

  async function save() {
    if (!name.trim()) {
      setError('Completa el nombre del cliente.');
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
        address: address.trim() || null,
        is_active: active,
      };

      if (editing) {
        await api.put(`/customers/${customerId}`, payload);
      } else {
        await api.post('/customers', payload);
      }

      router.back();
    } catch (requestError) {
      setError(requestErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!customerId) return;

    setSaving(true);
    setError('');

    try {
      await api.delete(`/customers/${customerId}`);
      router.back();
    } catch (requestError) {
      setError(requestErrorMessage(requestError));
      setConfirmingDelete(false);
    } finally {
      setSaving(false);
    }
  }

  if (!CUSTOMERS_MODULE) return null;

  return (
    <ModuleLayout module={CUSTOMERS_MODULE} selectedItemId="customers">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.screen}
      >
        {loading ? (
          <ActivityIndicator color="#426B8A" size="large" style={styles.loader} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Button compact icon="arrow-left" mode="text" onPress={() => router.back()}>
                Volver
              </Button>
              <Button
                buttonColor="#426B8A"
                compact
                disabled={saving}
                loading={saving}
                mode="contained"
                onPress={() => void save()}
              >
                Guardar
              </Button>
            </View>

            <Text style={styles.title}>{editing ? 'Editar cliente' : 'Nuevo cliente'}</Text>
            <Text style={styles.subtitle}>
              Registra los datos de identificación y contacto del cliente.
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.form}>
              <TextInput
                label="Nombre *"
                mode="flat"
                onChangeText={setName}
                style={styles.input}
                value={name}
              />
              <TextInput
                autoCapitalize="characters"
                label="Número de documento"
                maxLength={20}
                mode="flat"
                onChangeText={setDocumentNumber}
                style={styles.input}
                value={documentNumber}
              />
              <TextInput
                keyboardType="phone-pad"
                label="Teléfono"
                maxLength={30}
                mode="flat"
                onChangeText={setPhone}
                style={styles.input}
                value={phone}
              />
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                label="Correo electrónico"
                mode="flat"
                onChangeText={setEmail}
                style={styles.input}
                value={email}
              />
              <TextInput
                label="Dirección"
                maxLength={500}
                mode="flat"
                multiline
                numberOfLines={3}
                onChangeText={setAddress}
                style={styles.input}
                value={address}
              />
              <View style={styles.switchRow}>
                <View style={styles.switchCopy}>
                  <Text style={styles.switchText}>Cliente activo</Text>
                  <Text style={styles.switchHelp}>
                    Los clientes inactivos se conservan en el directorio.
                  </Text>
                </View>
                <Switch onValueChange={setActive} value={active} />
              </View>
            </View>

            {editing ? (
              <View style={styles.dangerZone}>
                {confirmingDelete ? (
                  <View>
                    <Text style={styles.dangerTitle}>¿Eliminar {name}?</Text>
                    <Text style={styles.dangerText}>
                      Esta acción retirará definitivamente al cliente del directorio.
                    </Text>
                    <View style={styles.dangerActions}>
                      <Button disabled={saving} onPress={() => setConfirmingDelete(false)}>
                        Cancelar
                      </Button>
                      <Button
                        buttonColor="#B33F55"
                        loading={saving}
                        mode="contained"
                        onPress={() => void remove()}
                        textColor="#FFFFFF"
                      >
                        Eliminar
                      </Button>
                    </View>
                  </View>
                ) : (
                  <Button
                    icon="trash-can-outline"
                    mode="text"
                    onPress={() => setConfirmingDelete(true)}
                    textColor="#B33F55"
                  >
                    Eliminar el cliente
                  </Button>
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
  screen: { flex: 1, backgroundColor: '#FAF9FA' },
  loader: { flex: 1 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { marginTop: 20, color: '#28222C', fontSize: 24, fontWeight: '800' },
  subtitle: { marginTop: 6, color: '#7C7480', fontSize: 12, lineHeight: 18 },
  error: { marginTop: 16, padding: 12, borderRadius: 8, color: '#923E4E', backgroundColor: '#FBEAEC' },
  form: { marginTop: 22, gap: 19 },
  input: { backgroundColor: 'transparent' },
  switchRow: { minHeight: 62, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#DED8E0' },
  switchCopy: { flex: 1 },
  switchText: { color: '#443C47', fontSize: 14, fontWeight: '700' },
  switchHelp: { marginTop: 3, color: '#8A838D', fontSize: 10 },
  dangerZone: { marginTop: 42, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#E5DADD', alignItems: 'flex-start' },
  dangerTitle: { color: '#8F3448', fontSize: 15, fontWeight: '800' },
  dangerText: { marginTop: 7, color: '#7C6970', fontSize: 11, lineHeight: 17 },
  dangerActions: { marginTop: 12, flexDirection: 'row', gap: 8 },
});
