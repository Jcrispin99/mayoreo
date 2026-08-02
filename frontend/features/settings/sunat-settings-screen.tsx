import * as DocumentPicker from 'expo-document-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Dialog,
  Icon,
  Menu,
  Portal,
  SegmentedButtons,
  Snackbar,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import { api, apiErrorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { COLORS } from '../../theme/colors';
import type { Store } from '../inventory/inventory-types';
import type { DocumentSeries } from '../pos/pos-types';
import type { FiscalIssuer } from './settings-types';

type IssuerForm = {
  ruc: string;
  legalName: string;
  tradeName: string;
  fiscalAddress: string;
  ubigeo: string;
  urbanization: string;
  department: string;
  province: string;
  district: string;
  phone: string;
  email: string;
  active: boolean;
};

type EstablishmentForm = {
  storeId: number | null;
  code: string;
  address: string;
  ubigeo: string;
  urbanization: string;
  department: string;
  province: string;
  district: string;
};

type SunatSection = 'issuer' | 'credentials' | 'certificate' | 'establishments' | 'series';

const SUNAT_SECTIONS: { id: SunatSection; label: string; icon: string }[] = [
  { id: 'issuer', label: 'Emisor', icon: 'office-building-outline' },
  { id: 'credentials', label: 'Clave SOL', icon: 'key-variant' },
  { id: 'certificate', label: 'Certificado', icon: 'certificate-outline' },
  { id: 'establishments', label: 'Establecimientos', icon: 'store-marker-outline' },
  { id: 'series', label: 'Series', icon: 'file-document-multiple-outline' },
];

const EMPTY_ISSUER: IssuerForm = {
  ruc: '',
  legalName: '',
  tradeName: '',
  fiscalAddress: '',
  ubigeo: '',
  urbanization: '',
  department: '',
  province: '',
  district: '',
  phone: '',
  email: '',
  active: true,
};

const EMPTY_ESTABLISHMENT: EstablishmentForm = {
  storeId: null,
  code: '0000',
  address: '',
  ubigeo: '',
  urbanization: '',
  department: '',
  province: '',
  district: '',
};

function requestErrorMessage(error: unknown, fallback = 'No se pudo completar la operación.') {
  const response = (error as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } }).response;
  const validationErrors = response?.data?.errors;
  const first = validationErrors ? Object.values(validationErrors).flat()[0] : null;
  return first ?? response?.data?.message ?? fallback;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function issuerToForm(issuer: FiscalIssuer): IssuerForm {
  return {
    ruc: issuer.ruc,
    legalName: issuer.legal_name,
    tradeName: issuer.trade_name ?? '',
    fiscalAddress: issuer.fiscal_address ?? '',
    ubigeo: issuer.ubigeo ?? '',
    urbanization: issuer.urbanization ?? '',
    department: issuer.department ?? '',
    province: issuer.province ?? '',
    district: issuer.district ?? '',
    phone: issuer.phone ?? '',
    email: issuer.email ?? '',
    active: issuer.is_active,
  };
}

function storeToForm(store: Store): EstablishmentForm {
  return {
    storeId: store.id,
    code: store.sunat_establishment_code ?? '0000',
    address: store.sunat_address ?? store.address ?? '',
    ubigeo: store.sunat_ubigeo ?? '',
    urbanization: store.sunat_urbanization ?? '',
    department: store.sunat_department ?? '',
    province: store.sunat_province ?? '',
    district: store.sunat_district ?? '',
  };
}

export function SunatSettingsScreen() {
  const { user } = useAuth();
  const permissions = user?.permissions;
  const canManageSettings = !permissions || permissions.includes('fiscal-settings.manage');
  const canManageCredentials = !permissions || permissions.includes('fiscal-credentials.manage');
  const canViewStores = !permissions || permissions.includes('stores.view');
  const canManageEstablishments = canManageSettings
    && (!permissions || permissions.includes('stores.manage'));
  const canViewSeries = !permissions || permissions.includes('pos-config.view');
  const [issuers, setIssuers] = useState<FiscalIssuer[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [series, setSeries] = useState<DocumentSeries[]>([]);
  const [selectedIssuerId, setSelectedIssuerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [issuerDialogVisible, setIssuerDialogVisible] = useState(false);
  const [issuerMenuVisible, setIssuerMenuVisible] = useState(false);
  const [editingIssuerId, setEditingIssuerId] = useState<number | null>(null);
  const [issuerForm, setIssuerForm] = useState<IssuerForm>(EMPTY_ISSUER);
  const [establishmentDialogVisible, setEstablishmentDialogVisible] = useState(false);
  const [storeMenuVisible, setStoreMenuVisible] = useState(false);
  const [establishmentForm, setEstablishmentForm] = useState<EstablishmentForm>(EMPTY_ESTABLISHMENT);
  const [environment, setEnvironment] = useState<'beta' | 'production'>('beta');
  const [solUsername, setSolUsername] = useState('');
  const [solPassword, setSolPassword] = useState('');
  const [certificatePassword, setCertificatePassword] = useState('');
  const [activeSection, setActiveSection] = useState<SunatSection>('issuer');

  const selectedIssuer = issuers.find((issuer) => issuer.id === selectedIssuerId) ?? issuers[0] ?? null;
  const linkedStores = useMemo(
    () => stores.filter((store) => store.fiscal_issuer_id === selectedIssuer?.id),
    [selectedIssuer?.id, stores],
  );
  const availableStores = useMemo(
    () => stores.filter((store) => store.fiscal_issuer_id === null || store.fiscal_issuer_id === selectedIssuer?.id),
    [selectedIssuer?.id, stores],
  );
  const issuerSeries = useMemo(
    () => series.filter((item) => item.fiscal_issuer_id === selectedIssuer?.id),
    [selectedIssuer?.id, series],
  );

  useEffect(() => {
    setEnvironment(selectedIssuer?.credentials?.environment ?? 'beta');
  }, [selectedIssuer?.credentials?.environment, selectedIssuer?.id]);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [issuerResponse, storeResponse, seriesResponse] = await Promise.all([
        api.get('/fiscal-issuers'),
        canViewStores ? api.get('/stores') : Promise.resolve(null),
        canViewSeries ? api.get('/document-series') : Promise.resolve(null),
      ]);
      const loadedIssuers: FiscalIssuer[] = issuerResponse.data.data ?? [];
      setIssuers(loadedIssuers);
      setStores(storeResponse?.data.data ?? []);
      setSeries(seriesResponse?.data.data ?? []);
      setSelectedIssuerId((current) => (
        loadedIssuers.some((issuer) => issuer.id === current) ? current : loadedIssuers[0]?.id ?? null
      ));
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'No se pudo cargar la configuración SUNAT.'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [canViewSeries, canViewStores]);

  useFocusEffect(useCallback(() => {
    void loadData();
  }, [loadData]));

  function selectIssuer(issuer: FiscalIssuer) {
    setIssuerMenuVisible(false);
    setSelectedIssuerId(issuer.id);
    setEnvironment(issuer.credentials?.environment ?? 'beta');
    setSolUsername('');
    setSolPassword('');
    setCertificatePassword('');
    setError('');
    setActiveSection('issuer');
  }

  function openNewIssuer() {
    setError('');
    setEditingIssuerId(null);
    setIssuerForm(EMPTY_ISSUER);
    setIssuerDialogVisible(true);
  }

  function openEditIssuer() {
    if (!selectedIssuer) return;
    setError('');
    setEditingIssuerId(selectedIssuer.id);
    setIssuerForm(issuerToForm(selectedIssuer));
    setIssuerDialogVisible(true);
  }

  async function saveIssuer() {
    if (!issuerForm.ruc.trim() || !issuerForm.legalName.trim()) {
      setError('Completa el RUC y la razón social.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      ruc: issuerForm.ruc.trim(),
      legal_name: issuerForm.legalName.trim(),
      trade_name: issuerForm.tradeName.trim() || null,
      fiscal_address: issuerForm.fiscalAddress.trim() || null,
      ubigeo: issuerForm.ubigeo.trim() || null,
      urbanization: issuerForm.urbanization.trim() || null,
      department: issuerForm.department.trim() || null,
      province: issuerForm.province.trim() || null,
      district: issuerForm.district.trim() || null,
      phone: issuerForm.phone.trim() || null,
      email: issuerForm.email.trim() || null,
      is_active: issuerForm.active,
    };
    try {
      const response = editingIssuerId
        ? await api.put(`/fiscal-issuers/${editingIssuerId}`, payload)
        : await api.post('/fiscal-issuers', payload);
      setIssuerDialogVisible(false);
      setSelectedIssuerId(Number(response.data.data.id));
      setMessage(editingIssuerId ? 'Emisor actualizado.' : 'Emisor creado.');
      await loadData(true);
    } catch (requestError) {
      setError(requestErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function saveCredentials() {
    if (!selectedIssuer) return;
    if (!solUsername.trim() && !solPassword && selectedIssuer.credentials?.has_sol_credentials !== true) {
      setError('Ingresa el usuario y la contraseña SOL.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.put(`/fiscal-issuers/${selectedIssuer.id}/credentials`, {
        environment,
        ...(solUsername.trim() ? { sol_username: solUsername.trim() } : {}),
        ...(solPassword ? { sol_password: solPassword } : {}),
      });
      setSolUsername('');
      setSolPassword('');
      setMessage('Credenciales SOL actualizadas.');
      await loadData(true);
    } catch (requestError) {
      setError(requestErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  function usePublicBetaCredentials() {
    setEnvironment('beta');
    setSolUsername('MODDATOS');
    setSolPassword('moddatos');
  }

  async function pickCertificate() {
    if (!selectedIssuer) return;
    setError('');
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/x-pem-file', 'application/x-pkcs12', 'application/octet-stream', 'text/plain'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const formData = new FormData();
    if (Platform.OS === 'web') {
      const fileResponse = await fetch(asset.uri);
      formData.append('certificate', await fileResponse.blob(), asset.name);
    } else {
      formData.append('certificate', {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType ?? 'application/octet-stream',
      } as unknown as Blob);
    }
    if (certificatePassword) formData.append('certificate_password', certificatePassword);
    setSaving(true);
    try {
      await api.post(`/fiscal-issuers/${selectedIssuer.id}/certificate`, formData);
      setCertificatePassword('');
      setMessage('Certificado cargado y validado.');
      await loadData(true);
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'No se pudo cargar el certificado.'));
    } finally {
      setSaving(false);
    }
  }

  async function removeCertificate() {
    if (!selectedIssuer) return;
    setSaving(true);
    setError('');
    try {
      await api.delete(`/fiscal-issuers/${selectedIssuer.id}/certificate`);
      setMessage('Certificado retirado.');
      await loadData(true);
    } catch (requestError) {
      setError(requestErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  function openNewEstablishment() {
    setError('');
    const firstStore = availableStores[0];
    setEstablishmentForm(firstStore ? storeToForm(firstStore) : EMPTY_ESTABLISHMENT);
    setEstablishmentDialogVisible(true);
  }

  function openEstablishment(store: Store) {
    setError('');
    setEstablishmentForm(storeToForm(store));
    setEstablishmentDialogVisible(true);
  }

  async function saveEstablishment() {
    if (!selectedIssuer || !establishmentForm.storeId) {
      setError('Selecciona una tienda.');
      return;
    }
    if (!establishmentForm.code || !establishmentForm.address || !establishmentForm.ubigeo
      || !establishmentForm.department || !establishmentForm.province || !establishmentForm.district) {
      setError('Completa el código, dirección, ubigeo, departamento, provincia y distrito.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.put(`/stores/${establishmentForm.storeId}`, {
        fiscal_issuer_id: selectedIssuer.id,
        sunat_establishment_code: establishmentForm.code.trim(),
        sunat_address: establishmentForm.address.trim(),
        sunat_ubigeo: establishmentForm.ubigeo.trim(),
        sunat_urbanization: establishmentForm.urbanization.trim() || null,
        sunat_department: establishmentForm.department.trim(),
        sunat_province: establishmentForm.province.trim(),
        sunat_district: establishmentForm.district.trim(),
      });
      setEstablishmentDialogVisible(false);
      setMessage('Establecimiento SUNAT guardado.');
      await loadData(true);
    } catch (requestError) {
      setError(requestErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <ActivityIndicator color={COLORS.primaryDark} size="large" style={styles.loader} />;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.toolbar}>
        <View style={styles.toolbarContent}>
          <View style={styles.headingRow}>
            {canManageSettings ? (
              <Button buttonColor={COLORS.primary} compact icon="plus" mode="contained" onPress={openNewIssuer}>
                Nuevo
              </Button>
            ) : null}
            <Text style={styles.title}>SUNAT</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {issuers.length === 0 ? (
          <View style={styles.empty}>
            <Icon color={COLORS.textMuted} size={42} source="office-building-cog-outline" />
            <Text style={styles.emptyTitle}>Aún no hay emisores fiscales</Text>
            <Text style={styles.emptyText}>Crea el primer emisor para configurar SUNAT.</Text>
          </View>
        ) : selectedIssuer ? (
          <>
            <View style={styles.issuerField}>
              <Text style={styles.fieldLabel}>Emisor fiscal</Text>
              {issuers.length > 1 ? (
                <Menu
                  anchor={(
                    <Pressable onPress={() => setIssuerMenuVisible(true)} style={styles.issuerSelector}>
                      <View style={styles.listCopy}>
                        <Text numberOfLines={1} style={styles.issuerName}>{selectedIssuer.trade_name || selectedIssuer.legal_name}</Text>
                        <Text style={styles.issuerRuc}>RUC {selectedIssuer.ruc}</Text>
                      </View>
                      <Icon color={COLORS.textMuted} size={21} source="chevron-down" />
                    </Pressable>
                  )}
                  onDismiss={() => setIssuerMenuVisible(false)}
                  visible={issuerMenuVisible}
                >
                  {issuers.map((issuer) => (
                    <Menu.Item
                      key={issuer.id}
                      leadingIcon={issuer.id === selectedIssuer.id ? 'check' : undefined}
                      onPress={() => selectIssuer(issuer)}
                      title={issuer.trade_name || issuer.legal_name}
                    />
                  ))}
                </Menu>
              ) : (
                <View style={styles.issuerSelector}>
                  <View style={styles.listCopy}>
                    <Text numberOfLines={1} style={styles.issuerName}>{selectedIssuer.trade_name || selectedIssuer.legal_name}</Text>
                    <Text style={styles.issuerRuc}>RUC {selectedIssuer.ruc}</Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.workspace}>
              <ScrollView contentContainerStyle={styles.tabs} horizontal showsHorizontalScrollIndicator={false}>
                {SUNAT_SECTIONS.map((section) => {
                  const active = activeSection === section.id;
                  return (
                    <Pressable
                      accessibilityState={{ selected: active }}
                      key={section.id}
                      onPress={() => {
                        setActiveSection(section.id);
                        setError('');
                      }}
                      style={[styles.tab, active && styles.tabActive]}
                    >
                      <Icon color={active ? '#6D28D9' : COLORS.textMuted} size={18} source={section.icon} />
                      <Text style={[styles.tabText, active && styles.tabTextActive]}>{section.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.panel}>
                {activeSection === 'issuer' ? (
                  <View style={styles.panelBody}>
                    <SectionHeader
                      action={canManageSettings ? <Button compact icon="pencil-outline" onPress={openEditIssuer}>Editar</Button> : undefined}
                      title="Datos del emisor"
                    />
                    <View style={styles.detailsGrid}>
                      <InfoRow label="Razón social" value={selectedIssuer.legal_name} />
                      <InfoRow label="Nombre comercial" value={selectedIssuer.trade_name || 'No registrado'} />
                      <InfoRow label="RUC" value={selectedIssuer.ruc} />
                      <InfoRow label="Domicilio fiscal" value={selectedIssuer.fiscal_address || 'No registrado'} />
                      <InfoRow label="Ubigeo" value={selectedIssuer.ubigeo || 'No registrado'} />
                      <InfoRow label="Ubicación" value={[selectedIssuer.department, selectedIssuer.province, selectedIssuer.district].filter(Boolean).join(' · ') || 'No registrada'} />
                    </View>
                  </View>
                ) : null}

                {activeSection === 'credentials' ? (
                  <View style={styles.panelBody}>
                    <SectionHeader title="Credenciales Clave SOL" />
                    <Text style={styles.panelDescription}>Selecciona el ambiente y registra el usuario secundario autorizado para facturación electrónica.</Text>
                    <View style={styles.formColumn}>
                      <SegmentedButtons
                        buttons={[
                          { label: 'Beta', value: 'beta', icon: 'flask-outline' },
                          { label: 'Producción', value: 'production', icon: 'shield-check-outline' },
                        ]}
                        onValueChange={(value) => setEnvironment(value as 'beta' | 'production')}
                        value={environment}
                      />
                      {environment === 'beta' ? (
                        <Button compact icon="flask-outline" onPress={usePublicBetaCredentials}>Usar credenciales públicas beta</Button>
                      ) : null}
                      <TextInput
                        autoCapitalize="characters"
                        label={selectedIssuer.credentials?.has_sol_username ? 'Nuevo usuario SOL (opcional)' : 'Usuario SOL *'}
                        mode="flat"
                        onChangeText={setSolUsername}
                        style={styles.input}
                        value={solUsername}
                      />
                      <TextInput
                        label={selectedIssuer.credentials?.has_sol_password ? 'Nueva contraseña SOL (opcional)' : 'Contraseña SOL *'}
                        mode="flat"
                        onChangeText={setSolPassword}
                        secureTextEntry
                        style={styles.input}
                        value={solPassword}
                      />
                      <View style={styles.inlineStatus}>
                        <Icon color={selectedIssuer.credentials?.has_sol_credentials ? COLORS.success : COLORS.warning} size={17} source={selectedIssuer.credentials?.has_sol_credentials ? 'check-circle-outline' : 'alert-circle-outline'} />
                        <Text style={styles.inlineStatusText}>{selectedIssuer.credentials?.has_sol_credentials ? 'Credenciales guardadas' : 'Credenciales pendientes'}</Text>
                      </View>
                      {canManageCredentials ? (
                        <View style={styles.panelActions}>
                          <Button disabled={saving} loading={saving} mode="contained" onPress={() => void saveCredentials()}>Guardar</Button>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ) : null}

                {activeSection === 'certificate' ? (
                  <View style={styles.panelBody}>
                    <SectionHeader title="Certificado digital" />
                    <Text style={styles.panelDescription}>Carga el archivo P12 o PFX que se utilizará para firmar los comprobantes.</Text>
                    <View style={styles.formColumn}>
                      {selectedIssuer.credentials?.certificate ? (
                        <View style={styles.certificate}>
                          <Icon color={selectedIssuer.credentials.certificate.is_expired ? COLORS.error : COLORS.success} size={25} source="certificate-outline" />
                          <View style={styles.certificateCopy}>
                            <Text numberOfLines={1} style={styles.certificateName}>{selectedIssuer.credentials.certificate.original_name}</Text>
                            <Text style={styles.certificateMeta}>Vence: {formatDate(selectedIssuer.credentials.certificate.expires_at)} · {selectedIssuer.credentials.certificate.key_algorithm} {selectedIssuer.credentials.certificate.key_size}</Text>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.emptyInline}>
                          <Icon color={COLORS.textMuted} size={26} source="certificate-outline" />
                          <Text style={styles.muted}>Aún no hay un certificado cargado.</Text>
                        </View>
                      )}
                      <TextInput
                        label="Contraseña del P12/PFX (si aplica)"
                        mode="flat"
                        onChangeText={setCertificatePassword}
                        secureTextEntry
                        style={styles.input}
                        value={certificatePassword}
                      />
                      {canManageCredentials ? (
                        <View style={styles.panelActions}>
                          <Button disabled={saving} icon="upload-outline" loading={saving} mode="contained" onPress={() => void pickCertificate()}>
                            {selectedIssuer.credentials?.has_certificate ? 'Reemplazar certificado' : 'Cargar certificado'}
                          </Button>
                          {selectedIssuer.credentials?.has_certificate ? <Button disabled={saving} onPress={() => void removeCertificate()} textColor={COLORS.error}>Retirar</Button> : null}
                        </View>
                      ) : null}
                    </View>
                  </View>
                ) : null}

                {activeSection === 'establishments' ? (
                  <View style={styles.panelBody}>
                    <SectionHeader
                      action={canManageEstablishments ? <Button compact icon="plus" onPress={openNewEstablishment}>Vincular tienda</Button> : undefined}
                      title="Establecimientos SUNAT"
                    />
                    <View style={styles.list}>
                      {linkedStores.length === 0 ? (
                        <View style={styles.emptyInline}>
                          <Icon color={COLORS.textMuted} size={26} source="storefront-outline" />
                          <Text style={styles.muted}>No hay tiendas vinculadas a este emisor.</Text>
                        </View>
                      ) : linkedStores.map((store) => (
                        <Pressable key={store.id} onPress={() => canManageEstablishments && openEstablishment(store)} style={styles.listItem}>
                          <View style={styles.listCopy}>
                            <View style={styles.nameRow}>
                              <Text style={styles.listTitle}>{store.name}</Text>
                              <Text style={styles.listCode}>{store.sunat_establishment_code}</Text>
                            </View>
                            <Text numberOfLines={2} style={styles.listMeta}>{store.sunat_address} · Ubigeo {store.sunat_ubigeo}</Text>
                          </View>
                          {canManageEstablishments ? <Icon color={COLORS.textMuted} size={21} source="chevron-right" /> : null}
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}

                {activeSection === 'series' ? (
                  <View style={styles.panelBody}>
                    <SectionHeader
                      action={canViewSeries ? <Button compact icon="arrow-right" onPress={() => router.push('/module/pos/document-series')}>Administrar series</Button> : undefined}
                      title="Series y correlativos"
                    />
                    <View style={styles.seriesList}>
                      {issuerSeries.length === 0 ? (
                        <View style={styles.emptyInline}>
                          <Icon color={COLORS.textMuted} size={26} source="file-document-outline" />
                          <Text style={styles.muted}>Este emisor todavía no tiene series configuradas.</Text>
                        </View>
                      ) : issuerSeries.map((item) => (
                        <View key={item.id} style={styles.seriesRow}>
                          <View style={styles.listCopy}>
                            <View style={styles.nameRow}>
                              <Text style={styles.seriesCode}>{item.series_code}</Text>
                              <Text style={styles.seriesType}>{item.document_type === 'receipt' ? 'Boleta' : item.document_type === 'invoice' ? 'Factura' : 'Nota de venta'}</Text>
                              {!item.is_active ? <Text style={styles.inactive}>Inactiva</Text> : null}
                            </View>
                            <Text style={styles.listMeta}>Último correlativo: {item.current_number} · Próximo: {item.next_number}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>

      <Portal>
        <Dialog onDismiss={() => setIssuerDialogVisible(false)} visible={issuerDialogVisible}>
          <Dialog.Title>{editingIssuerId ? 'Editar emisor fiscal' : 'Nuevo emisor fiscal'}</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogArea}>
            <ScrollView contentContainerStyle={styles.dialogContent} keyboardShouldPersistTaps="handled">
              {error ? <Text style={styles.dialogError}>{error}</Text> : null}
              <TextInput keyboardType="number-pad" label="RUC *" maxLength={11} mode="outlined" onChangeText={(value) => setIssuerForm((current) => ({ ...current, ruc: value.replace(/\D/g, '') }))} value={issuerForm.ruc} />
              <TextInput label="Razón social *" mode="outlined" onChangeText={(value) => setIssuerForm((current) => ({ ...current, legalName: value }))} value={issuerForm.legalName} />
              <TextInput label="Nombre comercial" mode="outlined" onChangeText={(value) => setIssuerForm((current) => ({ ...current, tradeName: value }))} value={issuerForm.tradeName} />
              <TextInput label="Domicilio fiscal" mode="outlined" onChangeText={(value) => setIssuerForm((current) => ({ ...current, fiscalAddress: value }))} value={issuerForm.fiscalAddress} />
              <View style={styles.formRow}>
                <TextInput keyboardType="number-pad" label="Ubigeo" maxLength={6} mode="outlined" onChangeText={(value) => setIssuerForm((current) => ({ ...current, ubigeo: value.replace(/\D/g, '') }))} style={styles.flexInput} value={issuerForm.ubigeo} />
                <TextInput label="Urbanización" mode="outlined" onChangeText={(value) => setIssuerForm((current) => ({ ...current, urbanization: value }))} style={styles.flexInput} value={issuerForm.urbanization} />
              </View>
              <TextInput label="Departamento" mode="outlined" onChangeText={(value) => setIssuerForm((current) => ({ ...current, department: value }))} value={issuerForm.department} />
              <TextInput label="Provincia" mode="outlined" onChangeText={(value) => setIssuerForm((current) => ({ ...current, province: value }))} value={issuerForm.province} />
              <TextInput label="Distrito" mode="outlined" onChangeText={(value) => setIssuerForm((current) => ({ ...current, district: value }))} value={issuerForm.district} />
              <View style={styles.formRow}>
                <TextInput label="Teléfono" mode="outlined" onChangeText={(value) => setIssuerForm((current) => ({ ...current, phone: value }))} style={styles.flexInput} value={issuerForm.phone} />
                <TextInput autoCapitalize="none" keyboardType="email-address" label="Correo" mode="outlined" onChangeText={(value) => setIssuerForm((current) => ({ ...current, email: value }))} style={styles.flexInput} value={issuerForm.email} />
              </View>
              <View style={styles.switchRow}><Text>Emisor activo</Text><Switch onValueChange={(value) => setIssuerForm((current) => ({ ...current, active: value }))} value={issuerForm.active} /></View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setIssuerDialogVisible(false)}>Cancelar</Button>
            <Button disabled={saving} loading={saving} onPress={() => void saveIssuer()}>Guardar</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog onDismiss={() => setEstablishmentDialogVisible(false)} visible={establishmentDialogVisible}>
          <Dialog.Title>Establecimiento SUNAT</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogArea}>
            <ScrollView contentContainerStyle={styles.dialogContent} keyboardShouldPersistTaps="handled">
              {error ? <Text style={styles.dialogError}>{error}</Text> : null}
              <Menu
                anchor={(
                  <Pressable onPress={() => setStoreMenuVisible(true)} style={styles.selector}>
                    <View><Text style={styles.selectorLabel}>Tienda *</Text><Text style={styles.selectorValue}>{stores.find((store) => store.id === establishmentForm.storeId)?.name ?? 'Seleccionar tienda'}</Text></View>
                    <Icon color={COLORS.textMuted} size={21} source="chevron-down" />
                  </Pressable>
                )}
                onDismiss={() => setStoreMenuVisible(false)}
                visible={storeMenuVisible}
              >
                {availableStores.map((store) => <Menu.Item key={store.id} onPress={() => { setEstablishmentForm(storeToForm(store)); setStoreMenuVisible(false); }} title={store.name} />)}
              </Menu>
              <TextInput autoCapitalize="characters" label="Código de establecimiento *" maxLength={4} mode="outlined" onChangeText={(value) => setEstablishmentForm((current) => ({ ...current, code: value }))} value={establishmentForm.code} />
              <TextInput label="Dirección fiscal *" mode="outlined" onChangeText={(value) => setEstablishmentForm((current) => ({ ...current, address: value }))} value={establishmentForm.address} />
              <View style={styles.formRow}>
                <TextInput keyboardType="number-pad" label="Ubigeo *" maxLength={6} mode="outlined" onChangeText={(value) => setEstablishmentForm((current) => ({ ...current, ubigeo: value.replace(/\D/g, '') }))} style={styles.flexInput} value={establishmentForm.ubigeo} />
                <TextInput label="Urbanización" mode="outlined" onChangeText={(value) => setEstablishmentForm((current) => ({ ...current, urbanization: value }))} style={styles.flexInput} value={establishmentForm.urbanization} />
              </View>
              <TextInput label="Departamento *" mode="outlined" onChangeText={(value) => setEstablishmentForm((current) => ({ ...current, department: value }))} value={establishmentForm.department} />
              <TextInput label="Provincia *" mode="outlined" onChangeText={(value) => setEstablishmentForm((current) => ({ ...current, province: value }))} value={establishmentForm.province} />
              <TextInput label="Distrito *" mode="outlined" onChangeText={(value) => setEstablishmentForm((current) => ({ ...current, district: value }))} value={establishmentForm.district} />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setEstablishmentDialogVisible(false)}>Cancelar</Button>
            <Button disabled={saving} loading={saving} onPress={() => void saveEstablishment()}>Guardar</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar duration={2600} onDismiss={() => setMessage('')} visible={Boolean(message)}>{message}</Snackbar>
    </View>
  );
}

function SectionHeader({ action, title }: { action?: React.ReactNode; title: string }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{action}</View>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  loader: { flex: 1 },
  toolbar: { borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface },
  toolbarContent: { width: '100%', maxWidth: 820, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 15 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  content: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: 20, paddingBottom: 48, gap: 18 },
  error: { padding: 12, borderRadius: 8, color: COLORS.error, backgroundColor: COLORS.errorContainer, fontSize: 12, fontWeight: '700' },
  empty: { minHeight: 260, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 12, color: COLORS.text, fontSize: 16, fontWeight: '800' },
  emptyText: { marginTop: 5, color: COLORS.textMuted, fontSize: 12 },
  issuerField: { gap: 3 },
  fieldLabel: { color: COLORS.textMuted, fontSize: 11 },
  issuerSelector: { minHeight: 58, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderStrong, flexDirection: 'row', alignItems: 'center' },
  issuerName: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
  issuerRuc: { marginTop: 2, color: COLORS.textMuted, fontSize: 10 },
  workspace: { overflow: 'hidden', borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  tabs: { minWidth: '100%', paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface },
  tab: { minHeight: 48, paddingHorizontal: 13, borderBottomWidth: 3, borderBottomColor: 'transparent', flexDirection: 'row', alignItems: 'center', gap: 7 },
  tabActive: { borderBottomColor: '#6D28D9' },
  tabText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700' },
  tabTextActive: { color: '#6D28D9', fontWeight: '800' },
  panel: { backgroundColor: COLORS.surface },
  panelBody: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingBottom: 30, gap: 19 },
  panelDescription: { marginTop: -10, color: COLORS.textMuted, fontSize: 11, lineHeight: 17 },
  formColumn: { width: '100%', gap: 19 },
  input: { backgroundColor: 'transparent' },
  panelActions: { paddingTop: 3, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9 },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 24 },
  sectionHeader: { minHeight: 38, paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionTitle: { flex: 1, color: COLORS.text, fontSize: 13, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  infoRow: { minWidth: 250, flexGrow: 1, flexBasis: 320, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  infoValue: { marginTop: 4, color: COLORS.text, fontSize: 12, fontWeight: '600' },
  inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  inlineStatusText: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700' },
  muted: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  certificate: { minHeight: 62, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
  certificateCopy: { flex: 1 },
  certificateName: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  certificateMeta: { marginTop: 3, color: COLORS.textMuted, fontSize: 10 },
  emptyInline: { minHeight: 120, padding: 18, alignItems: 'center', justifyContent: 'center', gap: 8 },
  list: { width: '100%' },
  listItem: { minHeight: 72, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', alignItems: 'center', gap: 11 },
  listCopy: { flex: 1 },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  listTitle: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
  listCode: { color: COLORS.primaryDark, fontSize: 10, fontWeight: '800' },
  listMeta: { marginTop: 4, color: COLORS.textMuted, fontSize: 11, lineHeight: 15 },
  seriesList: { width: '100%' },
  seriesRow: { minHeight: 72, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', alignItems: 'center' },
  seriesCode: { color: COLORS.text, fontSize: 14, fontWeight: '900' },
  seriesType: { color: COLORS.primaryDark, fontSize: 10, fontWeight: '800' },
  inactive: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7, color: COLORS.textMuted, backgroundColor: COLORS.surfaceSubtle, fontSize: 9, fontWeight: '800' },
  dialogArea: { paddingHorizontal: 0 },
  dialogContent: { padding: 20, gap: 12 },
  dialogError: { padding: 10, borderRadius: 9, color: COLORS.error, backgroundColor: COLORS.errorContainer, fontSize: 11, fontWeight: '700' },
  formRow: { flexDirection: 'row', gap: 10 },
  flexInput: { flex: 1 },
  switchRow: { minHeight: 62, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selector: { minHeight: 60, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderStrong, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectorLabel: { color: COLORS.textMuted, fontSize: 10 },
  selectorValue: { marginTop: 3, color: COLORS.text, fontSize: 13, fontWeight: '700' },
});
