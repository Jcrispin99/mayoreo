import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Icon, Menu, Portal, SegmentedButtons, Switch, Text, TextInput } from 'react-native-paper';
import { MultiSelectDropdown } from '../../components/data/multi-select-dropdown';
import { MultiSelectField } from '../../components/data/multi-select-field';
import { ModuleLayout } from '../../components/module/module-layout';
import { getVisibleMenu } from '../../config/menu';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import type { AttendanceShift, Compensation, PayrollLine, PayrollPeriod, StoreSummary } from '../workforce/workforce-types';
import type { AccessItem, AccessResourceKind, Permission, Role, UserAccount } from './access-types';

type AccessReferenceFormProps = { itemId?: string; kind: AccessResourceKind };
type UserTab = 'account' | 'labor' | 'salary' | 'attendance' | 'payments';

const ACCESS_MODULE = getVisibleMenu().find((module) => module.id === 'access');
const CONFIG = {
  users: { endpoint: '/users', singular: 'usuario', article: 'el' },
  roles: { endpoint: '/roles', singular: 'rol', article: 'el' },
} as const;
const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

function requestErrorMessage(error: any) {
  const validationErrors = error?.response?.data?.errors;
  const first = validationErrors ? Object.values(validationErrors).flat()[0] : null;
  return typeof first === 'string' ? first : error?.response?.data?.message ?? 'No se pudo completar la operación.';
}

function dateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Pendiente';
}

function duration(minutes: number | null) {
  return minutes === null ? 'En curso' : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function AccessReferenceForm({ itemId, kind }: AccessReferenceFormProps) {
  const { user: currentUser } = useAuth();
  const config = CONFIG[kind];
  const editing = Boolean(itemId);
  const [tab, setTab] = useState<UserTab>('account');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoleNames, setSelectedRoleNames] = useState<string[]>([]);
  const [selectedPermissionNames, setSelectedPermissionNames] = useState<string[]>([]);
  const [employeeEnabled, setEmployeeEnabled] = useState(false);
  const [employeeProfileId, setEmployeeProfileId] = useState<number | null>(null);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [storeMenuVisible, setStoreMenuVisible] = useState(false);
  const [employmentStatus, setEmploymentStatus] = useState<'active' | 'inactive'>('active');
  const [hiredAt, setHiredAt] = useState(new Date().toISOString().slice(0, 10));
  const [terminatedAt, setTerminatedAt] = useState('');
  const [terminationDialogVisible, setTerminationDialogVisible] = useState(false);
  const [terminationDraft, setTerminationDraft] = useState('');
  const [terminationError, setTerminationError] = useState('');
  const [expectedHours, setExpectedHours] = useState('8');
  const [monthlyDivisor, setMonthlyDivisor] = useState('30');
  const [workDays, setWorkDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [payType, setPayType] = useState<'monthly' | 'daily'>('monthly');
  const [payAmount, setPayAmount] = useState('');
  const [payEffectiveFrom, setPayEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [compensations, setCompensations] = useState<Compensation[]>([]);
  const [shifts, setShifts] = useState<AttendanceShift[]>([]);
  const [payments, setPayments] = useState<Array<PayrollLine & { period?: PayrollPeriod }>>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canManageEmployees = Boolean(currentUser?.permissions?.includes('employees.manage'));
  const canViewAttendance = Boolean(currentUser?.permissions?.includes('attendance.view'));
  const canViewPayroll = Boolean(currentUser?.permissions?.includes('payroll.view'));
  const canManagePayroll = Boolean(currentUser?.permissions?.includes('payroll.manage'));

  useEffect(() => {
    async function loadForm() {
      setLoading(true); setError('');
      try {
        const [itemResponse, optionsResponse, storesResponse] = await Promise.all([
          itemId ? api.get(`${config.endpoint}/${itemId}`) : Promise.resolve(null),
          api.get(kind === 'users' ? '/roles' : '/permissions'),
          kind === 'users' ? api.get('/stores', { params: { is_active: true } }).catch(() => null) : Promise.resolve(null),
        ]);
        const loadedItem: AccessItem | null = itemResponse?.data.data ?? null;
        if (kind === 'roles') {
          const role = loadedItem as Role | null;
          setPermissions(optionsResponse.data.data ?? []);
          setName(role?.name ?? '');
          setSelectedPermissionNames(role?.permissions?.map((permission) => permission.name) ?? []);
          return;
        }

        const loadedUser = loadedItem as UserAccount | null;
        const loadedStores: StoreSummary[] = storesResponse?.data.data ?? [];
        const profile = loadedUser?.employee_profile;
        setRoles(optionsResponse.data.data ?? []);
        setName(loadedUser?.name ?? ''); setEmail(loadedUser?.email ?? '');
        setSelectedRoleNames(loadedUser?.roles.map((role) => role.name) ?? []);
        setStores(loadedStores); setEmployeeEnabled(Boolean(profile)); setEmployeeProfileId(profile?.id ?? null);
        setStoreId(profile?.store_id ?? loadedStores[0]?.id ?? null);
        setEmploymentStatus(profile?.employment_status ?? 'active');
        setHiredAt(profile?.hired_at ?? new Date().toISOString().slice(0, 10));
        setTerminatedAt(profile?.terminated_at ?? '');
        setExpectedHours(String((profile?.expected_minutes_per_day ?? 480) / 60));
        setMonthlyDivisor(String(profile?.monthly_divisor ?? 30));
        setWorkDays(profile?.work_days ?? [0, 1, 2, 3, 4, 5, 6]);

        if (!profile?.id) return;
        const requests: Promise<any>[] = [];
        if (canViewPayroll) requests.push(api.get(`/employees/${profile.id}/compensations`));
        else requests.push(Promise.resolve(null));
        if (canViewAttendance) requests.push(api.get('/attendance-shifts', { params: { employee_profile_id: profile.id } }));
        else requests.push(Promise.resolve(null));
        if (canViewPayroll) requests.push(api.get(`/employees/${profile.id}/payroll-lines`));
        else requests.push(Promise.resolve(null));
        const [compensationResponse, attendanceResponse, paymentResponse] = await Promise.all(requests);
        const loadedCompensations: Compensation[] = compensationResponse?.data.data ?? [];
        setCompensations(loadedCompensations); setShifts(attendanceResponse?.data.data ?? []);
        const current = loadedCompensations[0];
        if (current) { setPayType(current.pay_type); setPayAmount(''); }
        setPayments(paymentResponse?.data.data ?? []);
      } catch (requestError) { setError(requestErrorMessage(requestError)); }
      finally { setLoading(false); }
    }
    void loadForm();
  }, [canViewAttendance, canViewPayroll, config.endpoint, itemId, kind]);

  function toggleSelection(id: string, selected: string[], setSelected: (ids: string[]) => void) {
    setSelected(selected.includes(id) ? selected.filter((selectedId) => selectedId !== id) : [...selected, id]);
  }

  function openTerminationDialog() {
    setTerminationDraft(terminatedAt || new Date().toISOString().slice(0, 10));
    setTerminationError('');
    setTerminationDialogVisible(true);
  }

  function confirmTermination() {
    if (!isIsoDate(terminationDraft)) { setTerminationError('Ingresa una fecha válida con formato AAAA-MM-DD.'); return; }
    if (hiredAt && terminationDraft < hiredAt) { setTerminationError('La fecha de cese no puede ser anterior a la fecha de ingreso.'); return; }
    setTerminatedAt(terminationDraft);
    setEmploymentStatus('inactive');
    setTerminationDialogVisible(false);
  }

  function reactivateEmployment() {
    setTerminatedAt('');
    setEmploymentStatus('active');
  }

  async function save() {
    if (!name.trim()) { setError('Completa el nombre.'); setTab('account'); return; }
    if (kind === 'users' && !email.trim()) { setError('Completa el correo electrónico.'); setTab('account'); return; }
    if (kind === 'users' && !editing && password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); setTab('account'); return; }
    if (kind === 'users' && password && password !== passwordConfirmation) { setError('Las contraseñas no coinciden.'); setTab('account'); return; }
    if (employeeEnabled && (!hiredAt || Number(expectedHours) <= 0 || workDays.length === 0)) { setError('Completa correctamente el perfil laboral y selecciona al menos un día.'); setTab('labor'); return; }
    if (employeeEnabled && employmentStatus === 'inactive' && !terminatedAt) { setError('Registra la fecha de cese para mantener el perfil laboral inactivo.'); setTab('labor'); return; }

    setSaving(true); setError('');
    try {
      if (kind === 'roles') {
        const payload = { name: name.trim(), permissions: selectedPermissionNames };
        editing ? await api.put(`/roles/${itemId}`, payload) : await api.post('/roles', payload);
        router.back(); return;
      }
      const payload = { name: name.trim(), email: email.trim().toLocaleLowerCase('es'), ...(password ? { password, password_confirmation: passwordConfirmation } : {}) };
      const response = editing ? await api.put(`/users/${itemId}`, payload) : await api.post('/users', payload);
      const savedId = Number(response.data.data.id);
      await api.put(`/users/${savedId}/roles`, { roles: selectedRoleNames });
      if (employeeEnabled && canManageEmployees) {
        const profileResponse = await api.put(`/users/${savedId}/employee-profile`, {
          store_id: storeId, employment_status: employmentStatus, hired_at: hiredAt, terminated_at: terminatedAt || null,
          expected_minutes_per_day: Math.round(Number(expectedHours) * 60), monthly_divisor: Number(monthlyDivisor), work_days: workDays,
        });
        const savedProfileId = Number(profileResponse.data.data.id);
        if (payAmount.trim() && canManagePayroll) await api.post(`/employees/${savedProfileId}/compensations`, {
          pay_type: payType, amount: Number(payAmount), effective_from: employeeProfileId ? payEffectiveFrom : hiredAt,
          notes: employeeProfileId ? 'Actualización desde la ficha del usuario' : 'Remuneración inicial',
        });
      } else if (employeeProfileId && canManageEmployees) {
        await api.put(`/users/${savedId}/employee-profile`, {
          store_id: storeId, employment_status: 'inactive', hired_at: hiredAt,
          terminated_at: terminatedAt || new Date().toISOString().slice(0, 10),
          expected_minutes_per_day: Math.round(Number(expectedHours) * 60), monthly_divisor: Number(monthlyDivisor), work_days: workDays,
        });
      }
      router.back();
    } catch (requestError) { setError(requestErrorMessage(requestError)); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!itemId) return;
    setSaving(true); setError('');
    try { await api.delete(`${config.endpoint}/${itemId}`); router.back(); }
    catch (requestError) { setError(requestErrorMessage(requestError)); setConfirmingDelete(false); }
    finally { setSaving(false); }
  }

  const allTabs: Array<{ id: UserTab; label: string; icon: string; visible: boolean }> = [
    { id: 'account', label: 'Cuenta', icon: 'account-key-outline', visible: true },
    { id: 'labor', label: 'Perfil laboral', icon: 'briefcase-account-outline', visible: canManageEmployees },
    { id: 'salary', label: 'Sueldo', icon: 'cash', visible: employeeEnabled && canViewPayroll },
    { id: 'attendance', label: 'Asistencia', icon: 'calendar-clock-outline', visible: editing && employeeEnabled && canViewAttendance },
    { id: 'payments', label: 'Pagos', icon: 'cash-check', visible: editing && employeeEnabled && canViewPayroll },
  ];
  const tabs = allTabs.filter((item) => item.visible);

  if (!ACCESS_MODULE) return null;
  return <ModuleLayout module={ACCESS_MODULE} selectedItemId={kind}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      {loading ? <ActivityIndicator color="#B4232D" size="large" style={styles.loader} /> : <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" nestedScrollEnabled showsVerticalScrollIndicator style={styles.scroll}>
        <View style={styles.header}><Button compact icon="arrow-left" onPress={() => router.back()}>Volver</Button><Button buttonColor="#FF4D4D" compact disabled={saving} loading={saving} mode="contained" onPress={() => void save()}>Guardar</Button></View>
        <Text style={styles.title}>{editing ? `Editar ${config.singular}` : `Nuevo ${config.singular}`}</Text>
        <Text style={styles.subtitle}>{kind === 'users' ? 'Una sola ficha para su cuenta, relación laboral, asistencia y pagos.' : 'Define el nombre del rol y sus permisos.'}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {kind === 'users' ? <ScrollView contentContainerStyle={styles.tabs} horizontal showsHorizontalScrollIndicator={false}>{tabs.map((item) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === item.id }} key={item.id} onPress={() => setTab(item.id)} style={[styles.tab, tab === item.id && styles.activeTab]}><Icon source={item.icon} color={tab === item.id ? '#B4232D' : '#60706E'} size={18} /><Text style={[styles.tabText, tab === item.id && styles.activeTabText]}>{item.label}</Text></Pressable>)}</ScrollView> : null}

        <View style={styles.form}>
          {kind === 'roles' ? <><TextInput label="Nombre *" mode="flat" onChangeText={setName} style={styles.input} value={name} /><MultiSelectField emptyText="No hay permisos configurados." onToggle={(permissionName) => toggleSelection(permissionName, selectedPermissionNames, setSelectedPermissionNames)} options={permissions.map((permission) => ({ id: permission.name, label: permission.name }))} selectedIds={selectedPermissionNames} title="Permisos" /></> : null}

          {kind === 'users' && tab === 'account' ? <>
            <TextInput label="Nombre *" mode="flat" onChangeText={setName} style={styles.input} value={name} />
            <TextInput autoCapitalize="none" keyboardType="email-address" label="Correo electrónico *" mode="flat" onChangeText={setEmail} style={styles.input} value={email} />
            <TextInput label={editing ? 'Nueva contraseña' : 'Contraseña *'} mode="flat" onChangeText={setPassword} secureTextEntry style={styles.input} value={password} />
            <TextInput label={editing ? 'Confirmar nueva contraseña' : 'Confirmar contraseña *'} mode="flat" onChangeText={setPasswordConfirmation} secureTextEntry style={styles.input} value={passwordConfirmation} />
            {editing ? <Text style={styles.help}>Deja la contraseña vacía para conservar la actual.</Text> : null}
            <MultiSelectDropdown emptyText="Primero crea un rol." label="Roles" onToggle={(roleName) => toggleSelection(roleName, selectedRoleNames, setSelectedRoleNames)} options={roles.map((role) => ({ id: role.name, label: role.name, description: `${role.permissions?.length ?? 0} permisos` }))} placeholder="Seleccionar roles" selectedIds={selectedRoleNames} />
          </> : null}

          {kind === 'users' && tab === 'labor' ? <>
            <View style={styles.switchRow}><View style={styles.switchCopy}><Text style={styles.sectionTitle}>Forma parte del personal</Text><Text style={styles.sectionHelp}>{employeeProfileId ? 'El perfil laboral ya está registrado. Usa las acciones de cese para cambiar su estado.' : 'Habilita horario, asistencia, sueldo y pagos para esta cuenta.'}</Text></View><Switch color="#B4232D" disabled={Boolean(employeeProfileId)} onValueChange={setEmployeeEnabled} value={employeeEnabled} /></View>
            {employeeEnabled ? <>
              <Menu anchor={<Pressable onPress={() => setStoreMenuVisible(true)} style={styles.selector}><View><Text style={styles.selectorLabel}>Tienda asignada</Text><Text style={styles.selectorValue}>{stores.find((store) => store.id === storeId)?.name ?? 'Sin tienda fija'}</Text></View><Icon source="chevron-down" size={21} color="#60706E" /></Pressable>} onDismiss={() => setStoreMenuVisible(false)} visible={storeMenuVisible}><Menu.Item onPress={() => { setStoreId(null); setStoreMenuVisible(false); }} title="Sin tienda fija" />{stores.map((store) => <Menu.Item key={store.id} onPress={() => { setStoreId(store.id); setStoreMenuVisible(false); }} title={`${store.code} · ${store.name}`} />)}</Menu>
              <View style={styles.employmentStatusCard}><View style={styles.employmentStatusCopy}><View style={[styles.statusBadge, employmentStatus === 'active' ? styles.statusActive : styles.statusInactive]}><Text style={[styles.statusBadgeText, employmentStatus === 'active' ? styles.statusActiveText : styles.statusInactiveText]}>{employmentStatus === 'active' ? 'ACTIVO' : 'INACTIVO'}</Text></View><Text style={styles.employmentStatusText}>{terminatedAt ? `Cese registrado: ${terminatedAt}` : 'Sin fecha de cese'}</Text></View>{employeeProfileId ? <View style={styles.employmentActions}>{employmentStatus === 'inactive' ? <Button compact icon="account-reactivate-outline" mode="outlined" onPress={reactivateEmployment}>Reactivar</Button> : null}<Button compact icon="calendar-remove-outline" mode={terminatedAt ? 'outlined' : 'contained'} onPress={openTerminationDialog}>{terminatedAt ? 'Modificar cese' : 'Registrar cese'}</Button></View> : null}</View>
              <TextInput label="Fecha de ingreso" mode="outlined" multiline={false} numberOfLines={1} onChangeText={setHiredAt} style={styles.singleLineInput} value={hiredAt} />
              <TextInput keyboardType="decimal-pad" label="Horas esperadas por día" maxLength={5} mode="outlined" multiline={false} numberOfLines={1} onChangeText={(value) => { const normalized = value.replace(',', '.'); if (/^\d{0,2}(?:\.\d{0,2})?$/.test(normalized)) setExpectedHours(normalized); }} style={styles.singleLineInput} value={expectedHours} />
              <Text style={styles.help}>El valor diario del sueldo mensual se calcula automáticamente según los días calendario del mes.</Text>
              <View style={styles.daysCard}><Text style={styles.fieldTitle}>Días laborables</Text><View style={styles.days}>{DAY_LABELS.map((label, day) => <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: workDays.includes(day) }} key={day} onPress={() => setWorkDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day])} style={[styles.day, workDays.includes(day) && styles.daySelected]}><Text style={[styles.dayText, workDays.includes(day) && styles.dayTextSelected]}>{label}</Text></Pressable>)}</View></View>
            </> : <View style={styles.emptyCard}><Icon source="account-off-outline" color="#60706E" size={42} /><Text style={styles.emptyTitle}>Cuenta sin perfil laboral</Text><Text style={styles.emptyText}>Puede acceder al sistema según sus roles, pero no marcará asistencia ni aparecerá en planillas.</Text></View>}
          </> : null}

          {kind === 'users' && tab === 'salary' ? <>
            <View><Text style={styles.sectionTitle}>{employeeProfileId ? 'Remuneración vigente e historial' : 'Remuneración inicial'}</Text><Text style={styles.sectionHelp}>Los cambios generan una nueva vigencia y no modifican planillas anteriores.</Text></View>
            {canManagePayroll ? <View style={styles.salaryBox}><SegmentedButtons buttons={[{ value: 'monthly', label: 'Mensual' }, { value: 'daily', label: 'Diario' }]} onValueChange={(value) => setPayType(value as 'monthly' | 'daily')} value={payType} /><View style={styles.twoColumns}><TextInput keyboardType="decimal-pad" label={employeeProfileId ? 'Nuevo importe' : 'Importe'} left={<TextInput.Affix text="S/" />} maxLength={12} mode="outlined" multiline={false} numberOfLines={1} onChangeText={(value) => { const normalized = value.replace(',', '.'); if (/^\d*(?:\.\d{0,2})?$/.test(normalized)) setPayAmount(normalized); }} selectTextOnFocus style={[styles.column, styles.singleLineInput]} value={payAmount} /><TextInput label="Vigente desde" mode="outlined" multiline={false} numberOfLines={1} onChangeText={setPayEffectiveFrom} style={[styles.column, styles.singleLineInput]} value={employeeProfileId ? payEffectiveFrom : hiredAt} /></View><Text style={styles.help}>{employeeProfileId ? 'Deja el importe vacío si solo guardarás otros datos.' : 'Se registrará al crear el perfil.'}</Text></View> : null}
            <View style={styles.history}>{compensations.map((compensation) => <View key={compensation.id} style={styles.historyRow}><View><Text style={styles.historyTitle}>{compensation.pay_type === 'monthly' ? 'Sueldo mensual' : 'Pago diario'}</Text><Text style={styles.historyMeta}>{compensation.effective_from} — {compensation.effective_to ?? 'Actual'}</Text></View><Text style={styles.money}>S/ {Number(compensation.amount).toFixed(2)}</Text></View>)}{compensations.length === 0 ? <Text style={styles.emptyText}>Aún no hay remuneraciones registradas.</Text> : null}</View>
          </> : null}

          {kind === 'users' && tab === 'attendance' ? <View style={styles.history}>{shifts.map((shift) => <View key={shift.id} style={styles.historyRow}><View style={styles.historyCopy}><Text style={styles.historyTitle}>{shift.store?.name ?? 'Tienda'} · {shift.status === 'open' ? 'En curso' : shift.status === 'incident' ? 'Incidencia' : 'Completa'}</Text><Text style={styles.historyMeta}>Entrada {dateTime(shift.clocked_in_at)} · Salida {dateTime(shift.clocked_out_at)}</Text></View><Text style={styles.duration}>{duration(shift.worked_minutes)}</Text></View>)}{shifts.length === 0 ? <View style={styles.emptyCard}><Icon source="calendar-blank-outline" color="#60706E" size={42} /><Text style={styles.emptyTitle}>Sin asistencias</Text><Text style={styles.emptyText}>Las entradas y salidas de este usuario aparecerán aquí.</Text></View> : null}</View> : null}

          {kind === 'users' && tab === 'payments' ? <View style={styles.history}>{payments.map((line) => <View key={line.id} style={styles.historyRow}><View style={styles.historyCopy}><Text style={styles.historyTitle}>{line.period?.starts_on} — {line.period?.ends_on}</Text><Text style={styles.historyMeta}>{line.valid_days}/{line.scheduled_days} días · {duration(line.worked_minutes)} · {line.incident_days} incidencias</Text></View><View style={styles.payCopy}><Text style={styles.money}>S/ {Number(line.payable_amount).toFixed(2)}</Text><Text style={styles.historyMeta}>{line.period?.status === 'closed' ? 'Cerrado' : 'Estimado'}</Text></View></View>)}{payments.length === 0 ? <View style={styles.emptyCard}><Icon source="cash-remove" color="#60706E" size={42} /><Text style={styles.emptyTitle}>Sin pagos calculados</Text><Text style={styles.emptyText}>Los periodos de planilla de este usuario aparecerán aquí.</Text></View> : null}</View> : null}
        </View>

        {editing && tab === 'account' ? <View style={styles.dangerZone}>{confirmingDelete ? <View><Text style={styles.dangerTitle}>¿Eliminar {name}?</Text><Text style={styles.dangerText}>Si tiene historial laboral deberá desactivarse en lugar de eliminarse.</Text><View style={styles.dangerActions}><Button disabled={saving} onPress={() => setConfirmingDelete(false)}>Cancelar</Button><Button buttonColor="#8F1D2C" loading={saving} mode="contained" onPress={() => void remove()} textColor="#FFFFFF">Eliminar</Button></View></View> : <Button icon="trash-can-outline" onPress={() => setConfirmingDelete(true)} textColor="#8F1D2C">Eliminar {config.article} {config.singular}</Button>}</View> : null}
      </ScrollView>}
      <Portal>
        <Dialog onDismiss={() => setTerminationDialogVisible(false)} visible={terminationDialogVisible}>
          <Dialog.Icon icon="calendar-remove-outline" />
          <Dialog.Title style={styles.dialogTitle}>{terminatedAt ? 'Modificar fecha de cese' : 'Registrar cese laboral'}</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogHelp}>La fecha limita la asistencia y el cálculo de planilla. Al confirmar, el perfil quedará inactivo.</Text>
            <TextInput autoFocus label="Fecha de cese" mode="outlined" multiline={false} numberOfLines={1} onChangeText={(value) => { setTerminationDraft(value); setTerminationError(''); }} placeholder="AAAA-MM-DD" style={styles.terminationInput} value={terminationDraft} />
            {terminationError ? <Text style={styles.dialogError}>{terminationError}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setTerminationDialogVisible(false)}>Cancelar</Button>
            <Button buttonColor="#8F1D2C" mode="contained" onPress={confirmTermination} textColor="#FFFFFF">Confirmar cese</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </KeyboardAvoidingView>
  </ModuleLayout>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, backgroundColor: '#F3F6F5' }, scroll: { flex: 1, minHeight: 0 }, loader: { flex: 1 }, content: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: 20, paddingBottom: 48 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { marginTop: 20, color: '#172423', fontSize: 24, fontWeight: '800' }, subtitle: { marginTop: 6, color: '#60706E', fontSize: 12, lineHeight: 18 }, error: { marginTop: 16, padding: 12, borderRadius: 8, color: '#8F1D2C', backgroundColor: '#FCE8EA' },
  tabs: { marginTop: 22, gap: 7 }, tab: { minHeight: 44, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7, borderBottomWidth: 2, borderBottomColor: 'transparent' }, activeTab: { borderBottomColor: '#B4232D', backgroundColor: '#FFE5E5' }, tabText: { color: '#60706E', fontSize: 11, fontWeight: '800' }, activeTabText: { color: '#B4232D' },
  form: { marginTop: 22, gap: 19 }, input: { backgroundColor: 'transparent' }, help: { color: '#60706E', fontSize: 10 }, sectionTitle: { color: '#172423', fontSize: 16, fontWeight: '900' }, sectionHelp: { marginTop: 4, color: '#60706E', fontSize: 11, lineHeight: 17 }, switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, switchCopy: { flex: 1 },
  selector: { minHeight: 58, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#879692', borderRadius: 8 }, selectorLabel: { color: '#60706E', fontSize: 10 }, selectorValue: { marginTop: 3, color: '#172423', fontSize: 13, fontWeight: '800' }, twoColumns: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, column: { flex: 1, minWidth: 210, backgroundColor: 'transparent' }, singleLineInput: { minHeight: 56, maxHeight: 56, backgroundColor: 'transparent' }, fieldTitle: { marginBottom: 9, color: '#60706E', fontSize: 11, fontWeight: '800' }, daysCard: { padding: 14, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 10, backgroundColor: '#FFFFFF' }, days: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, day: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 20 }, daySelected: { borderColor: '#B4232D', backgroundColor: '#FFE5E5' }, dayText: { color: '#60706E', fontWeight: '800' }, dayTextSelected: { color: '#B4232D' }, salaryBox: { padding: 16, gap: 14, borderRadius: 10, backgroundColor: '#FFFFFF' },
  employmentStatusCard: { padding: 14, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 10, backgroundColor: '#FFFFFF' }, employmentStatusCopy: { flex: 1, minWidth: 180, alignItems: 'flex-start', gap: 7 }, employmentStatusText: { color: '#60706E', fontSize: 11 }, employmentActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }, statusActive: { backgroundColor: '#E0F3EA' }, statusInactive: { backgroundColor: '#FCE8EA' }, statusBadgeText: { fontSize: 9, fontWeight: '900' }, statusActiveText: { color: '#247451' }, statusInactiveText: { color: '#8F1D2C' },
  history: { gap: 10 }, historyRow: { minHeight: 68, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 10, backgroundColor: '#FFFFFF' }, historyCopy: { flex: 1 }, historyTitle: { color: '#172423', fontSize: 13, fontWeight: '800' }, historyMeta: { marginTop: 4, color: '#60706E', fontSize: 10 }, money: { color: '#247451', fontSize: 15, fontWeight: '900' }, duration: { color: '#246B81', fontSize: 12, fontWeight: '800' }, payCopy: { alignItems: 'flex-end' },
  emptyCard: { padding: 30, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 12, backgroundColor: '#FFFFFF' }, emptyTitle: { color: '#172423', fontSize: 15, fontWeight: '900' }, emptyText: { color: '#60706E', fontSize: 11, lineHeight: 17, textAlign: 'center' }, dangerZone: { marginTop: 42, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#D7E0DE', alignItems: 'flex-start' }, dangerTitle: { color: '#8F1D2C', fontSize: 15, fontWeight: '800' }, dangerText: { marginTop: 7, color: '#60706E', fontSize: 11 }, dangerActions: { marginTop: 12, flexDirection: 'row', gap: 8 },
  dialogTitle: { textAlign: 'center' }, dialogHelp: { color: '#60706E', fontSize: 12, lineHeight: 18 }, terminationInput: { marginTop: 16, minHeight: 56, maxHeight: 56 }, dialogError: { marginTop: 8, color: '#8F1D2C', fontSize: 11 },
});
