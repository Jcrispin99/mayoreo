import { useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { ActivityIndicator, Button, Icon, IconButton, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Customer } from '../customers/customer-types';
import { api, apiErrorMessage } from '../../lib/api';
import { COLORS } from '../../theme/colors';
import { SPACING, TYPOGRAPHY } from '../../theme/tokens';

type PosCustomerSelectorProps = {
  selectedCustomer: Customer | null;
  visible: boolean;
  onClose: () => void;
  onSelect: (customer: Customer | null) => Promise<boolean>;
};

type ViewMode = 'list' | 'create';

export function PosCustomerSelector({
  selectedCustomer,
  visible,
  onClose,
  onSelect,
}: PosCustomerSelectorProps) {
  const [mode, setMode] = useState<ViewMode>('list');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [assigningId, setAssigningId] = useState<number | 'none' | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  const busy = saving || assigningId !== null;

  useEffect(() => {
    if (!visible) return;

    setMode('list');
    setQuery('');
    setError('');
  }, [visible]);

  useEffect(() => {
    if (!visible || mode !== 'list') return;

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/customers', {
          params: { is_active: 1, search: query.trim() || undefined },
          signal: controller.signal,
        });
        setCustomers((response.data.data ?? []) as Customer[]);
      } catch (requestError: unknown) {
        if (!controller.signal.aborted) {
          setError(apiErrorMessage(requestError, 'No se pudo cargar el directorio de clientes.'));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, query.trim() ? 300 : 0);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [mode, query, visible]);

  function resetCreateForm() {
    setName('');
    setDocumentNumber('');
    setPhone('');
    setEmail('');
    setAddress('');
    setError('');
  }

  async function selectCustomer(customer: Customer | null) {
    setAssigningId(customer?.id ?? 'none');
    setError('');
    try {
      const assigned = await onSelect(customer);
      if (assigned) {
        onClose();
      } else {
        setError('No se pudo actualizar el cliente de la orden. Inténtalo nuevamente.');
      }
    } finally {
      setAssigningId(null);
    }
  }

  async function createCustomer() {
    if (!name.trim()) {
      setError('Ingresa el nombre o razón social del cliente.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const response = await api.post('/customers', {
        name: name.trim(),
        document_number: documentNumber.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        is_active: true,
      });
      const customer = response.data.data as Customer;
      const assigned = await onSelect(customer);
      if (assigned) {
        onClose();
      } else {
        setError('El cliente fue registrado, pero no pudo asignarse a la orden.');
      }
    } catch (requestError: unknown) {
      setError(apiErrorMessage(requestError, 'No se pudo registrar el cliente.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={() => !busy && onClose()} presentationStyle="fullScreen" visible={visible}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <View style={styles.header}>
            {mode === 'create' ? (
              <IconButton
                accessibilityLabel="Volver al listado de clientes"
                disabled={busy}
                icon="arrow-left"
                onPress={() => { resetCreateForm(); setMode('list'); }}
              />
            ) : <View style={styles.headerSpacer} />}
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{mode === 'list' ? 'Cliente de la orden' : 'Nuevo cliente'}</Text>
              <Text style={styles.subtitle}>
                {mode === 'list' ? 'Busca o registra un cliente sin salir del POS' : 'Se guardará en el directorio de clientes'}
              </Text>
            </View>
            <IconButton accessibilityLabel="Cerrar clientes" disabled={busy} icon="close" onPress={onClose} />
          </View>

          {mode === 'list' ? (
            <>
              <View style={styles.searchArea}>
                <TextInput
                  autoCapitalize="none"
                  left={<TextInput.Icon icon="magnify" />}
                  mode="outlined"
                  onChangeText={setQuery}
                  placeholder="Nombre, documento, teléfono o email"
                  value={query}
                />
                <Button icon="account-plus-outline" mode="contained" onPress={() => { resetCreateForm(); setMode('create'); }}>
                  Crear cliente
                </Button>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void selectCustomer(null)}
                style={[styles.customerRow, selectedCustomer === null && styles.customerRowSelected]}
              >
                <View style={styles.customerIcon}>
                  <Icon color={COLORS.textMuted} size={24} source="account-off-outline" />
                </View>
                <View style={styles.customerCopy}>
                  <Text style={styles.customerName}>Sin cliente</Text>
                  <Text style={styles.customerMeta}>Venta al público general</Text>
                </View>
                {assigningId === 'none' ? <ActivityIndicator size={20} /> : selectedCustomer === null ? (
                  <Icon color={COLORS.primaryDark} size={23} source="check-circle" />
                ) : null}
              </Pressable>

              <FlatList
                contentContainerStyle={styles.list}
                data={customers}
                keyboardShouldPersistTaps="handled"
                keyExtractor={(customer) => String(customer.id)}
                ListEmptyComponent={loading ? (
                  <View style={styles.empty}>
                    <ActivityIndicator color={COLORS.primaryDark} size="large" />
                    <Text style={styles.customerMeta}>Cargando clientes…</Text>
                  </View>
                ) : (
                  <View style={styles.empty}>
                    <Icon color={COLORS.textMuted} size={40} source="account-search-outline" />
                    <Text style={styles.customerName}>No encontramos clientes</Text>
                    <Text style={styles.customerMeta}>Puedes cambiar la búsqueda o registrar uno nuevo.</Text>
                  </View>
                )}
                renderItem={({ item }) => {
                  const selected = selectedCustomer?.id === item.id;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => void selectCustomer(item)}
                      style={[styles.customerRow, selected && styles.customerRowSelected]}
                    >
                      <View style={[styles.customerIcon, selected && styles.customerIconSelected]}>
                        <Icon color={selected ? COLORS.primaryDark : COLORS.textMuted} size={24} source="account-outline" />
                      </View>
                      <View style={styles.customerCopy}>
                        <Text numberOfLines={1} style={styles.customerName}>{item.name}</Text>
                        <Text numberOfLines={1} style={styles.customerMeta}>
                          {[item.document_number, item.phone, item.email].filter(Boolean).join(' · ') || 'Sin datos adicionales'}
                        </Text>
                      </View>
                      {assigningId === item.id ? <ActivityIndicator size={20} /> : selected ? (
                        <Icon color={COLORS.primaryDark} size={23} source="check-circle" />
                      ) : <Icon color={COLORS.textMuted} size={22} source="chevron-right" />}
                    </Pressable>
                  );
                }}
                showsVerticalScrollIndicator={false}
              />
            </>
          ) : (
            <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TextInput label="Nombre o razón social *" mode="outlined" onChangeText={setName} value={name} />
              <TextInput label="Documento" mode="outlined" onChangeText={setDocumentNumber} value={documentNumber} />
              <TextInput keyboardType="phone-pad" label="Teléfono" mode="outlined" onChangeText={setPhone} value={phone} />
              <TextInput autoCapitalize="none" keyboardType="email-address" label="Email" mode="outlined" onChangeText={setEmail} value={email} />
              <TextInput label="Dirección" mode="outlined" multiline onChangeText={setAddress} value={address} />
              <Button
                contentStyle={styles.saveButtonContent}
                disabled={saving}
                icon="content-save-outline"
                loading={saving}
                mode="contained"
                onPress={() => void createCustomer()}
              >
                Registrar y seleccionar
              </Button>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: { minHeight: 68, paddingHorizontal: SPACING.xs, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface },
  headerSpacer: { width: 48 },
  headerCopy: { flex: 1, alignItems: 'center' },
  title: { ...TYPOGRAPHY.subtitle, color: COLORS.text },
  subtitle: { ...TYPOGRAPHY.metadata, marginTop: SPACING.xxs, color: COLORS.textMuted, textAlign: 'center' },
  searchArea: { padding: SPACING.md, gap: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface },
  error: { margin: SPACING.md, padding: SPACING.sm, borderRadius: SPACING.xs, color: COLORS.error, backgroundColor: COLORS.errorContainer },
  list: { paddingBottom: SPACING.xl },
  customerRow: { minHeight: 70, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface },
  customerRowSelected: { backgroundColor: COLORS.primaryContainer },
  customerIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: COLORS.surfaceSubtle },
  customerIconSelected: { backgroundColor: COLORS.surface },
  customerCopy: { flex: 1, minWidth: 0 },
  customerName: { ...TYPOGRAPHY.body, color: COLORS.text, fontWeight: '700' },
  customerMeta: { ...TYPOGRAPHY.metadata, marginTop: SPACING.xxs, color: COLORS.textMuted },
  empty: { minHeight: 220, padding: SPACING.lg, alignItems: 'center', justifyContent: 'center', gap: SPACING.xs },
  form: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: SPACING.md, paddingBottom: SPACING.xl, gap: SPACING.md },
  saveButtonContent: { minHeight: 48 },
});
