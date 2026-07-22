import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { MultiSelectField } from '../../components/data/multi-select-field';
import { MultiSelectDropdown } from '../../components/data/multi-select-dropdown';
import { ModuleLayout } from '../../components/module/module-layout';
import { getVisibleMenu } from '../../config/menu';
import { api } from '../../lib/api';
import type { AccessItem, AccessResourceKind, Permission, Role, UserAccount } from './access-types';

type AccessReferenceFormProps = {
  itemId?: string;
  kind: AccessResourceKind;
};

const ACCESS_MODULE = getVisibleMenu().find((module) => module.id === 'access');
const CONFIG = {
  users: { endpoint: '/users', singular: 'usuario', article: 'el' },
  roles: { endpoint: '/roles', singular: 'rol', article: 'el' },
} as const;

function requestErrorMessage(error: any) {
  const validationErrors = error?.response?.data?.errors;
  const firstValidationError = validationErrors ? Object.values(validationErrors).flat()[0] : null;
  if (typeof firstValidationError === 'string') return firstValidationError;
  return error?.response?.data?.message ?? 'No se pudo completar la operación.';
}

export function AccessReferenceForm({ itemId, kind }: AccessReferenceFormProps) {
  const config = CONFIG[kind];
  const editing = Boolean(itemId);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoleNames, setSelectedRoleNames] = useState<string[]>([]);
  const [selectedPermissionNames, setSelectedPermissionNames] = useState<string[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadForm() {
      setLoading(true);
      setError('');
      try {
        const [itemResponse, optionsResponse] = await Promise.all([
          itemId ? api.get(`${config.endpoint}/${itemId}`) : Promise.resolve(null),
          api.get(kind === 'users' ? '/roles' : '/permissions'),
        ]);
        const loadedItem: AccessItem | null = itemResponse?.data.data ?? null;
        if (kind === 'users') {
          const availableRoles: Role[] = optionsResponse.data.data ?? [];
          const user = loadedItem as UserAccount | null;
          setRoles(availableRoles);
          setName(user?.name ?? '');
          setEmail(user?.email ?? '');
          setSelectedRoleNames(user?.roles.map((role) => role.name) ?? []);
        } else {
          const availablePermissions: Permission[] = optionsResponse.data.data ?? [];
          const role = loadedItem as Role | null;
          setPermissions(availablePermissions);
          setName(role?.name ?? '');
          setSelectedPermissionNames(role?.permissions?.map((permission) => permission.name) ?? []);
        }
      } catch (requestError) {
        setError(requestErrorMessage(requestError));
      } finally {
        setLoading(false);
      }
    }

    void loadForm();
  }, [config.endpoint, itemId, kind]);

  function toggleSelection(id: string, selected: string[], setSelected: (ids: string[]) => void) {
    setSelected(selected.includes(id) ? selected.filter((selectedId) => selectedId !== id) : [...selected, id]);
  }

  async function save() {
    if (!name.trim()) {
      setError('Completa el nombre.');
      return;
    }
    if (kind === 'users' && !email.trim()) {
      setError('Completa el correo electrónico.');
      return;
    }
    if (kind === 'users' && !editing && password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (kind === 'users' && password && password !== passwordConfirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (kind === 'users') {
        const payload: Record<string, unknown> = {
          name: name.trim(),
          email: email.trim().toLocaleLowerCase('es'),
          ...(password ? { password, password_confirmation: passwordConfirmation } : {}),
        };
        const response = editing
          ? await api.put(`/users/${itemId}`, payload)
          : await api.post('/users', payload);
        const savedId = Number(response.data.data.id);
        await api.put(`/users/${savedId}/roles`, { roles: selectedRoleNames });
      } else {
        const payload = { name: name.trim(), permissions: selectedPermissionNames };
        if (editing) {
          await api.put(`/roles/${itemId}`, payload);
        } else {
          await api.post('/roles', payload);
        }
      }
      router.back();
    } catch (requestError) {
      setError(requestErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!itemId) return;
    setSaving(true);
    setError('');
    try {
      await api.delete(`${config.endpoint}/${itemId}`);
      router.back();
    } catch (requestError) {
      setError(requestErrorMessage(requestError));
      setConfirmingDelete(false);
    } finally {
      setSaving(false);
    }
  }

  if (!ACCESS_MODULE) return null;

  return (
    <ModuleLayout module={ACCESS_MODULE} selectedItemId={kind}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        {loading ? (
          <ActivityIndicator color="#73547B" size="large" style={styles.loader} />
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Button compact icon="arrow-left" mode="text" onPress={() => router.back()}>Volver</Button>
              <Button
                buttonColor="#73547B"
                compact
                disabled={saving}
                loading={saving}
                mode="contained"
                onPress={() => void save()}
              >
                Guardar
              </Button>
            </View>

            <Text style={styles.title}>{editing ? `Editar ${config.singular}` : `Nuevo ${config.singular}`}</Text>
            <Text style={styles.subtitle}>
              {kind === 'users'
                ? 'Administra los datos de acceso y los roles asignados al usuario.'
                : 'Define el nombre del rol y selecciona todos los permisos que le corresponden.'}
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.form}>
              <TextInput label="Nombre *" mode="flat" onChangeText={setName} style={styles.input} value={name} />

              {kind === 'users' ? (
                <>
                  <TextInput
                    autoCapitalize="none"
                    keyboardType="email-address"
                    label="Correo electrónico *"
                    mode="flat"
                    onChangeText={setEmail}
                    style={styles.input}
                    value={email}
                  />
                  <TextInput
                    label={editing ? 'Nueva contraseña' : 'Contraseña *'}
                    mode="flat"
                    onChangeText={setPassword}
                    secureTextEntry
                    style={styles.input}
                    value={password}
                  />
                  <TextInput
                    label={editing ? 'Confirmar nueva contraseña' : 'Confirmar contraseña *'}
                    mode="flat"
                    onChangeText={setPasswordConfirmation}
                    secureTextEntry
                    style={styles.input}
                    value={passwordConfirmation}
                  />
                  {editing ? (
                    <Text style={styles.help}>Deja la contraseña vacía para conservar la actual.</Text>
                  ) : null}
                  <MultiSelectDropdown
                    emptyText="Primero crea un rol para poder asignarlo."
                    label="Roles"
                    onToggle={(roleName) => toggleSelection(roleName, selectedRoleNames, setSelectedRoleNames)}
                    options={roles.map((role) => ({
                      id: role.name,
                      label: role.name,
                      description: `${role.permissions?.length ?? 0} permisos`,
                    }))}
                    placeholder="Seleccionar roles"
                    selectedIds={selectedRoleNames}
                  />
                </>
              ) : (
                <MultiSelectField
                  emptyText="No hay permisos configurados en el sistema."
                  onToggle={(permissionName) => toggleSelection(
                    permissionName,
                    selectedPermissionNames,
                    setSelectedPermissionNames,
                  )}
                  options={permissions.map((permission) => ({ id: permission.name, label: permission.name }))}
                  selectedIds={selectedPermissionNames}
                  title="Permisos"
                />
              )}
            </View>

            {editing ? (
              <View style={styles.dangerZone}>
                {confirmingDelete ? (
                  <View>
                    <Text style={styles.dangerTitle}>¿Eliminar {name}?</Text>
                    <Text style={styles.dangerText}>Esta acción retirará definitivamente {config.article} {config.singular}.</Text>
                    <View style={styles.dangerActions}>
                      <Button disabled={saving} onPress={() => setConfirmingDelete(false)}>Cancelar</Button>
                      <Button buttonColor="#B33F55" loading={saving} mode="contained" onPress={() => void remove()} textColor="#FFFFFF">Eliminar</Button>
                    </View>
                  </View>
                ) : (
                  <Button icon="trash-can-outline" mode="text" onPress={() => setConfirmingDelete(true)} textColor="#B33F55">
                    Eliminar {config.article} {config.singular}
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
  help: { marginTop: -10, color: '#89818C', fontSize: 10 },
  dangerZone: { marginTop: 42, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#E5DADD', alignItems: 'flex-start' },
  dangerTitle: { color: '#8F3448', fontSize: 15, fontWeight: '800' },
  dangerText: { marginTop: 7, color: '#7C6970', fontSize: 11, lineHeight: 17 },
  dangerActions: { marginTop: 12, flexDirection: 'row', gap: 8 },
});
