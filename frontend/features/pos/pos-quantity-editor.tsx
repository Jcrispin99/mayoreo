import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Icon, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  formatBaseQuantity,
  formatPosQuantity,
  pricingDisplay,
  resolvePriceTier,
  saleUnitOptions,
  type PosMeasuredProduct,
  type PosSaleUnitCode,
} from './pos-measurement';

type PosQuantityEditorProps = {
  busy: boolean;
  currentBaseQuantity: number;
  onClose: () => void;
  onConfirm: (quantity: number, unitCode: PosSaleUnitCode) => Promise<boolean>;
  product: PosMeasuredProduct | null;
};

function inputNumber(value: number) {
  return Number.isFinite(value)
    ? value.toFixed(6).replace(/\.?0+$/, '')
    : '';
}

function parseQuantity(value: string) {
  return Number(value.trim().replace(',', '.'));
}

function money(value: number) {
  return `S/ ${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;
}

export function PosQuantityEditor({
  busy,
  currentBaseQuantity,
  onClose,
  onConfirm,
  product,
}: PosQuantityEditorProps) {
  const options = useMemo(() => saleUnitOptions(product?.base_unit ?? null), [product?.base_unit]);
  const [unitCode, setUnitCode] = useState<PosSaleUnitCode>('kg');
  const [quantity, setQuantity] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedUnit = options.find((option) => option.code === unitCode) ?? options[0] ?? null;
  const numericQuantity = parseQuantity(quantity);
  const baseQuantity = selectedUnit ? numericQuantity * selectedUnit.factor : 0;
  const tier = product ? resolvePriceTier(product.price_tiers, baseQuantity) : null;
  const priceDisplay = pricingDisplay(product?.base_unit ?? null);
  const displayUnitPrice = tier ? Number(tier.unit_price) * priceDisplay.factor : 0;
  const total = tier ? baseQuantity * Number(tier.unit_price) : 0;
  const valid = Boolean(
    product
    && selectedUnit
    && Number.isFinite(numericQuantity)
    && numericQuantity > 0
    && tier,
  );

  useEffect(() => {
    if (!product || options.length === 0) return;

    const initialUnit = currentBaseQuantity > 0 && currentBaseQuantity < 1000
      ? options.find((option) => option.factor === 1) ?? options[0]
      : options[0];
    const initialQuantity = currentBaseQuantity > 0
      ? currentBaseQuantity / initialUnit.factor
      : 1;

    setUnitCode(initialUnit.code);
    setQuantity(inputNumber(initialQuantity));
    setSaving(false);
    setError('');
  }, [currentBaseQuantity, options, product]);

  function changeUnit(nextCode: string) {
    const nextUnit = options.find((option) => option.code === nextCode);
    if (!nextUnit) return;

    const currentBase = selectedUnit && Number.isFinite(numericQuantity)
      ? numericQuantity * selectedUnit.factor
      : nextUnit.factor;
    setUnitCode(nextUnit.code);
    setQuantity(inputNumber(currentBase / nextUnit.factor));
    setError('');
  }

  async function confirm() {
    if (!selectedUnit || !valid) {
      setError(tier
        ? 'Ingresa una cantidad mayor a cero.'
        : 'No existe un precio activo para esta cantidad.');
      return;
    }

    setSaving(true);
    setError('');
    const confirmed = await onConfirm(numericQuantity, selectedUnit.code);
    if (!confirmed) setError('No se pudo guardar la cantidad. Revisa el mensaje del POS.');
    setSaving(false);
  }

  if (!product || !selectedUnit) return null;

  return (
    <Modal
      animationType="slide"
      onRequestClose={() => !busy && !saving && onClose()}
      statusBarTranslucent
      transparent
      visible
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modal}
      >
        <Pressable
          accessibilityLabel="Cerrar selector de cantidad"
          disabled={busy || saving}
          onPress={onClose}
          style={styles.backdrop}
        />

        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.productIcon}>
              <Icon color="#28738A" size={22} source={product.base_unit?.type === 'weight' ? 'weight' : 'cup-water'} />
            </View>
            <View style={styles.headerText}>
              <Text numberOfLines={2} style={styles.title}>{product.name}</Text>
              <Text numberOfLines={1} style={styles.sku}>{product.sku}</Text>
            </View>
            <Pressable
              accessibilityLabel="Cerrar"
              disabled={busy || saving}
              hitSlop={8}
              onPress={onClose}
              style={styles.closeButton}
            >
              <Icon color="#596469" size={22} source="close" />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.label}>Unidad de venta</Text>
            <SegmentedButtons
              buttons={options.map((option) => ({
                accessibilityLabel: `Vender en ${option.label}`,
                label: option.label,
                value: option.code,
              }))}
              density="small"
              onValueChange={changeUnit}
              style={styles.units}
              value={selectedUnit.code}
            />

            <TextInput
              autoFocus
              dense
              error={Boolean(error)}
              keyboardType="decimal-pad"
              label="Cantidad"
              mode="outlined"
              onChangeText={(value) => {
                setQuantity(value);
                setError('');
              }}
              outlineColor="#CBD6D9"
              right={<TextInput.Affix text={selectedUnit.label} />}
              selectTextOnFocus
              style={styles.quantityInput}
              value={quantity}
            />

            <View style={styles.quickValues}>
              {selectedUnit.quickValues.map((value) => {
                const selected = Math.abs(numericQuantity - value) < 0.000001;

                return (
                  <Pressable
                    accessibilityRole="button"
                    key={value}
                    onPress={() => {
                      setQuantity(inputNumber(value));
                      setError('');
                    }}
                    style={[styles.quickValue, selected && styles.quickValueSelected]}
                  >
                    <Text style={[styles.quickValueText, selected && styles.quickValueTextSelected]}>
                      {formatPosQuantity(value)} {selectedUnit.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Cantidad base</Text>
                <Text style={styles.summaryValue}>
                  {Number.isFinite(baseQuantity) && baseQuantity > 0
                    ? formatBaseQuantity(baseQuantity, product.base_unit)
                    : '—'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Precio aplicado</Text>
                <View style={styles.priceDetail}>
                  <Text numberOfLines={1} style={styles.summaryValue}>{tier?.label ?? 'Sin rango'}</Text>
                  {tier ? (
                    <Text style={styles.unitPrice}>
                      {money(displayUnitPrice)} / {priceDisplay.unit}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total del producto</Text>
                <Text adjustsFontSizeToFit numberOfLines={1} style={styles.total}>{money(total)}</Text>
              </View>
            </View>

            {currentBaseQuantity > 0 ? (
              <Text style={styles.editHelp}>
                Esta cantidad reemplazará la cantidad actual del producto en la orden.
              </Text>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <Button
              disabled={busy || saving}
              mode="text"
              onPress={onClose}
              textColor="#667277"
            >
              Cancelar
            </Button>
            <Button
              buttonColor="#28738A"
              disabled={busy || saving || !valid}
              loading={saving}
              mode="contained"
              onPress={() => void confirm()}
            >
              {currentBaseQuantity > 0 ? 'Actualizar cantidad' : 'Agregar a la orden'}
            </Button>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', inset: 0, backgroundColor: 'rgba(29, 35, 38, 0.48)' },
  sheet: { width: '100%', maxWidth: 620, maxHeight: '90%', alignSelf: 'center', borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: '#FFFFFF' },
  handle: { width: 42, height: 4, marginTop: 8, marginBottom: 5, alignSelf: 'center', borderRadius: 2, backgroundColor: '#CAD2D5' },
  header: { minHeight: 62, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#E2E7E9' },
  productIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#E8F3F5' },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: '#302A33', fontSize: 15, lineHeight: 19, fontWeight: '900' },
  sku: { marginTop: 2, color: '#858D91', fontSize: 9, fontWeight: '700' },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#F0F3F4' },
  content: { padding: 16, paddingBottom: 12 },
  label: { marginBottom: 7, color: '#596469', fontSize: 10, fontWeight: '800' },
  units: { marginBottom: 14 },
  quantityInput: { backgroundColor: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  quickValues: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  quickValue: { minHeight: 34, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#C9D6D9', borderRadius: 17, backgroundColor: '#FFFFFF' },
  quickValueSelected: { borderColor: '#28738A', backgroundColor: '#E8F3F5' },
  quickValueText: { color: '#59656A', fontSize: 10, fontWeight: '800' },
  quickValueTextSelected: { color: '#28738A' },
  error: { marginTop: 9, color: '#A44256', fontSize: 10, fontWeight: '700' },
  summary: { marginTop: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#DCE4E6', borderRadius: 12, backgroundColor: '#F8FAFA' },
  summaryRow: { minHeight: 50, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: '#E2E7E9' },
  summaryLabel: { color: '#687378', fontSize: 10, fontWeight: '700' },
  summaryValue: { color: '#3E494E', fontSize: 11, fontWeight: '900', textAlign: 'right' },
  priceDetail: { flex: 1, alignItems: 'flex-end' },
  unitPrice: { marginTop: 2, color: '#76557E', fontSize: 10, fontWeight: '800' },
  totalRow: { minHeight: 58, borderBottomWidth: 0, backgroundColor: '#EEF7F4' },
  totalLabel: { color: '#337B67', fontSize: 11, fontWeight: '900' },
  total: { flex: 1, color: '#28738A', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  editHelp: { marginTop: 9, color: '#7E898D', fontSize: 9, lineHeight: 14, textAlign: 'center' },
  actions: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 7, borderTopWidth: 1, borderTopColor: '#E1E7E9', backgroundColor: '#FFFFFF' },
});
