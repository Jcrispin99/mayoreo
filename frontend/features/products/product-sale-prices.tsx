import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Icon, Snackbar, Switch, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModuleLayout } from '../../components/module/module-layout';
import { getVisibleMenu } from '../../config/menu';
import { api } from '../../lib/api';

type Unit = { id: number; code: string; name: string };

type PriceTier = {
  id: number;
  product_id: number;
  min_quantity: string | number;
  max_quantity: string | number | null;
  unit_price: string | number;
  label: string | null;
  is_active: boolean;
};

type Product = {
  id: number;
  name: string;
  variant_name?: string | null;
  sku: string;
  is_active?: boolean;
  base_unit: Unit | null;
  price_tiers: PriceTier[];
};

type ProductTemplate = {
  id: number;
  name: string;
  variants: Product[];
};

type PricingUnit = {
  code: string;
  name: string;
  factor: number;
};

type PriceTierEditorProps = {
  baseUnit: Unit | null;
  productId: string;
  tier: PriceTier | null;
  visible: boolean;
  onClose: () => void;
  onDeleted: (tierId: number) => void;
  onSaved: (tier: PriceTier) => void;
};

const PRODUCTS_MODULE = getVisibleMenu().find((module) => module.id === 'inventory');

function normalizeDecimal(value: string) {
  return value.trim().replace(',', '.');
}

function formatDecimal(value: string | number, decimals = 6) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return String(value);
  return numericValue.toFixed(decimals).replace(/\.?0+$/, '');
}

function getPricingUnit(baseUnit: Unit | null): PricingUnit {
  const code = baseUnit?.code.trim().toLocaleLowerCase('es') ?? '';
  if (code === 'g' || code === 'gr') return { code: 'kg', name: 'kilogramo', factor: 1000 };
  if (code === 'ml') return { code: 'L', name: 'litro', factor: 1000 };
  return { code: baseUnit?.code ?? 'unidad', name: baseUnit?.name.toLocaleLowerCase('es') ?? 'unidad', factor: 1 };
}

function getPricingUnitTitle(pricingUnit: PricingUnit) {
  if (pricingUnit.code === 'kg') return 'Kilogramos';
  if (pricingUnit.code === 'L') return 'Litros';
  return pricingUnit.name.charAt(0).toLocaleUpperCase('es') + pricingUnit.name.slice(1);
}

function formatMoney(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

function formatHumanQuantity(value: number, baseUnit: Unit | null) {
  const code = baseUnit?.code.trim().toLocaleLowerCase('es') ?? '';
  if ((code === 'g' || code === 'gr') && value >= 1000) return `${formatDecimal(value / 1000)} kg`;
  if (code === 'ml' && value >= 1000) return `${formatDecimal(value / 1000)} L`;
  return `${formatDecimal(value)} ${baseUnit?.code ?? 'unidad'}`;
}

function formatTierRange(tier: PriceTier, baseUnit: Unit | null) {
  const min = Number(tier.min_quantity);
  if (tier.max_quantity == null) return `Desde ${formatHumanQuantity(min, baseUnit)}`;

  const max = Number(tier.max_quantity);
  const exclusiveLimit = Math.ceil(max);
  const hasFractionalBoundary = exclusiveLimit > max && exclusiveLimit - max <= 0.0000011;
  const formattedMax = formatHumanQuantity(hasFractionalBoundary ? exclusiveLimit : max, baseUnit);
  if (min === 0 && hasFractionalBoundary) return `Menos de ${formattedMax}`;
  return `${formatHumanQuantity(min, baseUnit)} a ${hasFractionalBoundary ? `menos de ${formattedMax}` : formattedMax}`;
}

function requestErrorMessage(requestError: any, fallback: string) {
  const validationErrors = requestError?.response?.data?.errors;
  const firstValidationError = validationErrors ? Object.values(validationErrors).flat()[0] : null;
  if (typeof firstValidationError === 'string') return firstValidationError;
  const message = requestError?.response?.data?.message;
  return typeof message === 'string' ? message : fallback;
}

function PriceTierEditor({ baseUnit, productId, tier, visible, onClose, onDeleted, onSaved }: PriceTierEditorProps) {
  const [label, setLabel] = useState('');
  const [minQuantity, setMinQuantity] = useState('0');
  const [maxQuantity, setMaxQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState('');
  const pricingUnit = getPricingUnit(baseUnit);

  useEffect(() => {
    if (!visible) return;
    setLabel(tier?.label ?? '');
    setMinQuantity(tier ? formatDecimal(tier.min_quantity) : '0');
    setMaxQuantity(tier?.max_quantity == null ? '' : formatDecimal(tier.max_quantity));
    setUnitPrice(tier ? formatMoney(Number(tier.unit_price) * pricingUnit.factor) : '');
    setActive(tier?.is_active ?? true);
    setConfirmingDelete(false);
    setError('');
  }, [pricingUnit.factor, tier, visible]);

  async function save() {
    const normalizedMin = normalizeDecimal(minQuantity);
    const normalizedMax = normalizeDecimal(maxQuantity);
    const normalizedPrice = normalizeDecimal(unitPrice);
    const min = Number(normalizedMin);
    const max = normalizedMax ? Number(normalizedMax) : null;
    const price = Number(normalizedPrice);

    if (!Number.isFinite(min) || min < 0 || !Number.isFinite(price) || price <= 0) {
      setError('Ingresa una cantidad mínima válida y un precio mayor a cero.');
      return;
    }
    if (max !== null && (!Number.isFinite(max) || max <= min)) {
      setError('La cantidad máxima debe ser mayor que la cantidad mínima.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        label: label.trim() || null,
        min_quantity: normalizedMin,
        max_quantity: normalizedMax || null,
        unit_price: formatDecimal(price / pricingUnit.factor, 6),
        is_active: active,
      };
      const response = tier
        ? await api.put(`/price-tiers/${tier.id}`, payload)
        : await api.post(`/products/${productId}/price-tiers`, payload);
      onSaved(response.data.data);
      onClose();
    } catch (requestError: any) {
      setError(requestErrorMessage(requestError, 'No se pudo guardar el precio de venta.'));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!tier) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/price-tiers/${tier.id}`);
      onDeleted(tier.id);
      onClose();
    } catch (requestError: any) {
      setError(requestErrorMessage(requestError, 'No se pudo eliminar el precio de venta.'));
      setConfirmingDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  const unitName = baseUnit ? `${baseUnit.name} (${baseUnit.code})` : 'unidad base';

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.modalSafeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <Pressable accessibilityLabel="Volver a precios de venta" hitSlop={8} onPress={onClose} style={styles.backIconButton}>
              <Icon source="arrow-left" color="#172423" size={22} />
            </Pressable>
            <Text style={styles.modalTitle}>{tier ? 'Editar precio de venta' : 'Nuevo precio de venta'}</Text>
          </View>

          <ScrollView contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled">
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TextInput label="Nombre del rango" mode="flat" onChangeText={setLabel} style={styles.input} value={label} />
            <Text style={styles.fieldHelp}>Ejemplo: Menudeo, Mayor o Saco.</Text>

            <View style={styles.inputRow}>
              <TextInput
                keyboardType="decimal-pad"
                label="Cantidad desde *"
                mode="flat"
                onChangeText={setMinQuantity}
                style={[styles.input, styles.rowInput]}
                value={minQuantity}
              />
              <TextInput
                keyboardType="decimal-pad"
                label="Cantidad hasta"
                mode="flat"
                onChangeText={setMaxQuantity}
                style={[styles.input, styles.rowInput]}
                value={maxQuantity}
              />
            </View>
            <Text style={styles.fieldHelp}>Cantidades expresadas en {unitName}. Deja “hasta” vacío para no establecer un límite.</Text>

            <TextInput
              keyboardType="decimal-pad"
              label={`Precio por ${pricingUnit.code} *`}
              left={<TextInput.Affix text="S/" />}
              mode="flat"
              onChangeText={setUnitPrice}
              style={styles.input}
              value={unitPrice}
            />
            <Text style={styles.fieldHelp}>
              Escribe el precio completo por {pricingUnit.name}. Se convertirá automáticamente a {baseUnit?.code ?? 'la unidad base'} para calcular fracciones.
            </Text>

            <View style={styles.switchRow}>
              <View style={styles.switchCopy}>
                <Text style={styles.switchTitle}>Precio activo</Text>
                <Text style={styles.switchDescription}>Podrá seleccionarse automáticamente al registrar una venta.</Text>
              </View>
              <Switch onValueChange={setActive} value={active} />
            </View>

            {tier ? (
              confirmingDelete ? (
                <View style={styles.deleteConfirmation}>
                  <Text style={styles.deleteTitle}>¿Eliminar este rango de precio?</Text>
                  <Text style={styles.deleteText}>Esta acción no se puede deshacer.</Text>
                  <View style={styles.deleteActions}>
                    <Button disabled={deleting} mode="text" onPress={() => setConfirmingDelete(false)}>Cancelar</Button>
                    <Button loading={deleting} mode="contained" buttonColor="#8F1D2C" onPress={() => void remove()} textColor="#FFFFFF">Eliminar</Button>
                  </View>
                </View>
              ) : (
                <Button icon="trash-can-outline" mode="text" onPress={() => setConfirmingDelete(true)} textColor="#8F1D2C">
                  Eliminar rango
                </Button>
              )
            ) : null}
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button disabled={saving || deleting} mode="outlined" onPress={onClose}>Cancelar</Button>
            <Button buttonColor="#FF4D4D" disabled={deleting} loading={saving} mode="contained" onPress={() => void save()}>
              Guardar precio
            </Button>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export function ProductSalePrices({
  productId,
  templateId,
}: {
  productId?: string;
  templateId?: string;
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [tiers, setTiers] = useState<PriceTier[]>([]);
  const [selectedTier, setSelectedTier] = useState<PriceTier | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const pricingUnit = getPricingUnit(product?.base_unit ?? null);

  const loadProduct = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let loadedProducts: Product[];
      let loadedTemplateName = '';

      if (templateId) {
        const response = await api.get(`/product-templates/${templateId}`);
        const template = response.data.data as ProductTemplate;
        loadedProducts = (template.variants ?? []).filter((item) => item.is_active !== false);
        loadedTemplateName = template.name;
      } else if (productId) {
        const response = await api.get(`/products/${productId}`);
        loadedProducts = [response.data.data as Product];
      } else {
        throw new Error('Missing product identifier');
      }

      const loadedProduct = loadedProducts.find((item) => item.id === product?.id) ?? loadedProducts[0] ?? null;
      setProducts(loadedProducts);
      setTemplateName(loadedTemplateName);
      setProduct(loadedProduct);
      setTiers((loadedProduct?.price_tiers ?? []).sort((first, second) => Number(first.min_quantity) - Number(second.min_quantity)));
    } catch {
      setError('No se pudieron cargar los precios de venta del producto.');
    } finally {
      setLoading(false);
    }
  }, [productId, templateId]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  function openNewTier() {
    setSelectedTier(null);
    setEditorVisible(true);
  }

  function openTier(tier: PriceTier) {
    setSelectedTier(tier);
    setEditorVisible(true);
  }

  function selectProduct(nextProduct: Product) {
    setProduct(nextProduct);
    setTiers([...(nextProduct.price_tiers ?? [])].sort(
      (first, second) => Number(first.min_quantity) - Number(second.min_quantity),
    ));
    setEditorVisible(false);
  }

  function saveTier(savedTier: PriceTier) {
    setTiers((current) => {
      const next = current.some((tier) => tier.id === savedTier.id)
        ? current.map((tier) => (tier.id === savedTier.id ? savedTier : tier))
        : [...current, savedTier];
      return next.sort((first, second) => Number(first.min_quantity) - Number(second.min_quantity));
    });
    setMessage(selectedTier ? 'Precio de venta actualizado' : 'Precio de venta agregado');
  }

  function deleteTier(tierId: number) {
    setTiers((current) => current.filter((tier) => tier.id !== tierId));
    setMessage('Precio de venta eliminado');
  }

  if (!PRODUCTS_MODULE) return null;

  return (
    <ModuleLayout module={PRODUCTS_MODULE} selectedItemId="product-list">
      <View style={styles.screen}>
        {loading ? (
          <ActivityIndicator color="#B4232D" size="large" style={styles.loader} />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.pageHeader}>
              <Button compact icon="arrow-left" mode="text" onPress={() => router.back()}>Volver</Button>
            </View>

            <View style={styles.titleRow}>
              <Text style={styles.title}>Precios de venta</Text>
              {product ? (
                <View style={styles.unitNotice}>
                  <Text style={styles.unitNoticeText}>{getPricingUnitTitle(pricingUnit)} ({pricingUnit.code})</Text>
                </View>
              ) : null}
            </View>
            {product ? (
              <Text style={styles.subtitle}>
                {templateName || product.name} · {product.variant_name || 'Producto simple'} · {product.sku}
              </Text>
            ) : null}
            {error ? (
              <View style={styles.loadError}>
                <Text style={styles.error}>{error}</Text>
                <Button mode="text" onPress={() => void loadProduct()}>Reintentar</Button>
              </View>
            ) : null}

            {products.length > 1 ? (
              <View style={styles.variantSelector}>
                <Text style={styles.sectionTitle}>Combinación</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.variantSelectorContent}>
                  {products.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => selectProduct(item)}
                      style={[styles.variantOption, item.id === product?.id && styles.variantOptionSelected]}
                    >
                      <Text style={[styles.variantOptionText, item.id === product?.id && styles.variantOptionTextSelected]}>
                        {item.variant_name || item.sku}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Rangos</Text>
              <Text style={styles.counter}>{tiers.length}</Text>
              <Button
                compact
                contentStyle={styles.addButtonContent}
                labelStyle={styles.addButtonLabel}
                mode="outlined"
                disabled={!product}
                onPress={openNewTier}
                style={styles.addButton}
              >
                Agregar
              </Button>
            </View>

            {tiers.length === 0 && !error ? (
              <View style={styles.emptyState}>
                <Icon source="tag-multiple-outline" color="#60706E" size={36} />
                <Text style={styles.emptyTitle}>Aún no hay precios de venta</Text>
                <Text style={styles.emptyText}>Agrega el primer rango para definir precios de menudeo, mayor o saco.</Text>
              </View>
            ) : (
              <View style={styles.tierList}>
                {tiers.map((tier) => {
                  const range = formatTierRange(tier, product?.base_unit ?? null);
                  const displayedPrice = Number(tier.unit_price) * pricingUnit.factor;
                  return (
                    <Pressable
                      accessibilityHint="Abre el formulario para modificar este precio"
                      accessibilityRole="button"
                      key={tier.id}
                      onPress={() => openTier(tier)}
                      style={({ pressed }) => [styles.tierCard, pressed && styles.tierCardPressed]}
                    >
                      <View style={styles.tierHeader}>
                        <Text style={styles.tierTitle}>{tier.label || 'Sin nombre'}</Text>
                        <View style={[styles.statusBadge, !tier.is_active && styles.inactiveBadge]}>
                          <Text style={[styles.statusText, !tier.is_active && styles.inactiveStatusText]}>{tier.is_active ? 'Activo' : 'Inactivo'}</Text>
                        </View>
                      </View>
                      <View style={styles.tierDetails}>
                        <Text style={styles.rangeText}>{range}</Text>
                        <View style={styles.priceColumn}>
                          <Text style={styles.priceText}>S/ {formatMoney(displayedPrice)}</Text>
                          <Text style={styles.priceUnit}>por {pricingUnit.code}</Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}

        <PriceTierEditor
          baseUnit={product?.base_unit ?? null}
          onClose={() => setEditorVisible(false)}
          onDeleted={deleteTier}
          onSaved={saveTier}
          productId={String(product?.id ?? '')}
          tier={selectedTier}
          visible={editorVisible}
        />
        <Snackbar duration={2200} onDismiss={() => setMessage('')} visible={Boolean(message)}>{message}</Snackbar>
      </View>
    </ModuleLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' },
  loader: { flex: 1 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  pageHeader: { flexDirection: 'row', alignItems: 'center' },
  titleRow: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  title: { color: '#172423', fontSize: 24, fontWeight: '800' },
  subtitle: { marginTop: 4, color: '#60706E', fontSize: 13 },
  loadError: { marginTop: 16, alignItems: 'flex-start' },
  error: { padding: 12, borderRadius: 8, color: '#8F1D2C', backgroundColor: '#FCE8EA' },
  unitNotice: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 6, backgroundColor: '#EAEFEE' },
  unitNoticeText: { color: '#172423', fontSize: 12, fontWeight: '700' },
  variantSelector: { marginTop: 24, gap: 10 },
  variantSelectorContent: { gap: 8, paddingRight: 8 },
  variantOption: { paddingHorizontal: 13, paddingVertical: 9, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 18, backgroundColor: '#FFFFFF' },
  variantOptionSelected: { borderColor: '#B4232D', backgroundColor: '#B4232D' },
  variantOptionText: { color: '#172423', fontSize: 11, fontWeight: '700' },
  variantOptionTextSelected: { color: '#FFFFFF' },
  sectionHeader: { marginTop: 28, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: '#D7E0DE' },
  sectionTitle: { flex: 1, color: '#172423', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  counter: { minWidth: 24, paddingHorizontal: 7, paddingVertical: 2, textAlign: 'center', color: '#B4232D', fontSize: 11, fontWeight: '800', borderRadius: 6, backgroundColor: '#FFE5E5' },
  addButton: { borderRadius: 6 },
  addButtonContent: { height: 30, paddingHorizontal: 2 },
  addButtonLabel: { marginHorizontal: 5, marginVertical: 0, fontSize: 11, lineHeight: 14 },
  emptyState: { marginTop: 16, padding: 34, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 8, backgroundColor: '#FFFFFF' },
  emptyTitle: { color: '#172423', fontSize: 15, fontWeight: '800' },
  emptyText: { maxWidth: 390, textAlign: 'center', color: '#60706E', fontSize: 11, lineHeight: 17 },
  tierList: { marginTop: 12, gap: 10 },
  tierCard: { minHeight: 92, padding: 15, gap: 13, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 8, backgroundColor: '#FFFFFF' },
  tierCardPressed: { backgroundColor: '#EAEFEE' },
  tierHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  tierTitle: { flex: 1, color: '#172423', fontSize: 14, fontWeight: '800' },
  tierDetails: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, backgroundColor: '#E4F3E8' },
  inactiveBadge: { backgroundColor: '#EAEFEE' },
  statusText: { color: '#337347', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  inactiveStatusText: { color: '#60706E' },
  rangeText: { flexGrow: 1, flexShrink: 1, color: '#60706E', fontSize: 11, lineHeight: 16 },
  priceColumn: { alignItems: 'flex-end' },
  priceText: { color: '#B4232D', fontSize: 15, fontWeight: '900' },
  priceUnit: { marginTop: 2, color: '#60706E', fontSize: 10 },
  modalSafeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  modalScreen: { flex: 1 },
  modalHeader: { minHeight: 56, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#DCDDE0' },
  backIconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { marginLeft: 4, color: '#172423', fontSize: 16, fontWeight: '800' },
  editorContent: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingTop: 28, gap: 18, paddingBottom: 40 },
  input: { backgroundColor: 'transparent' },
  inputRow: { flexDirection: 'row', gap: 14 },
  rowInput: { flex: 1 },
  fieldHelp: { marginTop: -13, color: '#60706E', fontSize: 10, lineHeight: 15 },
  switchRow: { minHeight: 64, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#879692' },
  switchCopy: { flex: 1, marginRight: 12 },
  switchTitle: { color: '#172423', fontSize: 14, fontWeight: '700' },
  switchDescription: { marginTop: 3, color: '#60706E', fontSize: 10 },
  deleteConfirmation: { padding: 14, gap: 6, borderRadius: 8, backgroundColor: '#FCE8EA' },
  deleteTitle: { color: '#8F1D2C', fontSize: 13, fontWeight: '800' },
  deleteText: { color: '#8F1D2C', fontSize: 11 },
  deleteActions: { marginTop: 6, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  modalFooter: { padding: 14, flexDirection: 'row', justifyContent: 'flex-end', gap: 10, borderTopWidth: 1, borderTopColor: '#DCDDE0', backgroundColor: '#FFFFFF' },
});
