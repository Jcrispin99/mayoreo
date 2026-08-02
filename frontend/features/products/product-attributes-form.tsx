import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Icon, Snackbar, Text, TextInput } from 'react-native-paper';
import { ModuleLayout } from '../../components/module/module-layout';
import { getVisibleMenu } from '../../config/menu';
import { api, apiErrorMessage } from '../../lib/api';

type Unit = {
  id: number;
  code: string;
  name: string;
  type: 'weight' | 'volume' | 'count';
};

type AttributeValueSelection = {
  attribute: string;
  value: string;
};

type AttributeValueRow = {
  key: string;
  value: string;
  factor: string;
  price: string;
};

type AttributeRow = {
  key: string;
  name: string;
  values: AttributeValueRow[];
  pendingValue: string;
};

type VariantDraft = {
  id?: number;
  variant_name: string;
  sku: string;
  barcode: string;
  base_unit_id: number | null;
  sale_mode: 'unit' | 'measured';
  content_quantity: string | number | null;
  content_unit_id: number | null;
  is_active: boolean;
  is_favorite: boolean;
  is_principal: boolean;
  attribute_values: AttributeValueSelection[];
};

type ProductTemplateResponse = {
  id: number;
  name: string;
  description: string | null;
  default_price: string | number | null;
  is_active: boolean;
  is_pos_visible: boolean;
  attributes: Array<{
    id: number;
    name: string;
    values: Array<{
      id: number;
      value: string;
      price: string | number;
      factor: string | number | null;
    }>;
  }>;
  variants: Array<{
    id: number;
    variant_name: string | null;
    sku: string;
    barcode: string | null;
    base_unit_id: number;
    sale_mode: 'unit' | 'measured';
    content_quantity: string | number | null;
    content_unit_id: number | null;
    is_active: boolean;
    is_favorite: boolean;
    is_principal: boolean;
    attribute_values: AttributeValueSelection[];
  }>;
};

const PRODUCTS_MODULE = getVisibleMenu().find((module) => module.id === 'inventory');

function draftKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalized(value: string) {
  return value.trim().toLocaleLowerCase('es');
}

function decimal(value: string | number | null | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '';
  return parsed.toFixed(4).replace(/\.?0+$/, '');
}

function contentUnitLabel(unit: Unit, rawQuantity: string) {
  const name = unit.name.trim().toLocaleLowerCase('es') || unit.code;
  const quantity = Number((rawQuantity.trim() || '1').replace(',', '.'));

  if (quantity === 1 || !unit.name.trim()) return name;
  if (name.endsWith('s')) return name;
  if (name.endsWith('z')) return `${name.slice(0, -1)}ces`;
  if (/[aeiouáéíóú]$/.test(name)) return `${name}s`;
  return `${name}es`;
}

function slug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
}

function selectionSignature(selections: AttributeValueSelection[]) {
  return [...selections]
    .sort((first, second) => normalized(first.attribute).localeCompare(normalized(second.attribute)))
    .map((selection) => `${normalized(selection.attribute)}:${normalized(selection.value)}`)
    .join('|');
}

function cartesianProduct(attributes: AttributeRow[]): AttributeValueSelection[][] {
  return attributes.reduce<AttributeValueSelection[][]>(
    (combinations, attribute) => combinations.flatMap((combination) => (
      attribute.values.map((value) => [
        ...combination,
        { attribute: attribute.name.trim(), value: value.value },
      ])
    )),
    [[]],
  );
}

function suggestedFactor(value: string, baseUnit?: Unit) {
  if (!baseUnit || baseUnit.type === 'count') return '';
  const match = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|gr|l|lt|ml)$/i);
  if (!match) return '';

  const amount = Number(match[1].replace(',', '.'));
  const code = match[2].toLocaleLowerCase('es');
  const weight = code === 'kg' || code === 'g' || code === 'gr';
  if ((baseUnit.type === 'weight') !== weight) return '';

  const factor = code === 'kg' || code === 'l' || code === 'lt' ? 1000 : 1;
  return String(amount * factor);
}

function contentFromSelections(
  selections: AttributeValueSelection[],
  units: Unit[],
  attributes: AttributeRow[],
  baseContentUnitId: number | null,
) {
  const baseUnit = units.find((unit) => unit.id === baseContentUnitId);
  if (baseUnit && baseUnit.type !== 'count') {
    for (const selection of selections) {
      const attribute = attributes.find((item) => normalized(item.name) === normalized(selection.attribute));
      const value = attribute?.values.find((item) => normalized(item.value) === normalized(selection.value));
      if (value?.factor.trim() && Number(value.factor) > 0) {
        return {
          content_quantity: value.factor.trim(),
          content_unit_id: baseUnit.id,
        };
      }
    }
  }

  for (const selection of selections) {
    const match = selection.value.trim().match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|gr|l|lt|ml)$/i);
    if (!match) continue;

    const amount = Number(match[1].replace(',', '.'));
    const code = match[2].toLocaleLowerCase('es');
    const weight = code === 'kg' || code === 'g' || code === 'gr';
    const targetCode = weight ? 'g' : 'ml';
    const factor = code === 'kg' || code === 'l' || code === 'lt' ? 1000 : 1;
    const unit = units.find((candidate) => normalized(candidate.code) === targetCode);

    if (unit && Number.isFinite(amount)) {
      return {
        content_quantity: String(amount * factor),
        content_unit_id: unit.id,
      };
    }
  }

  return { content_quantity: null, content_unit_id: null };
}

function newVariant(
  units: Unit[],
  productName: string,
  selections: AttributeValueSelection[],
  attributes: AttributeRow[],
  baseContentUnitId: number | null,
): VariantDraft {
  const countUnit = units.find((unit) => unit.type === 'count') ?? units[0];
  const values = selections.map((selection) => selection.value);
  const content = contentFromSelections(selections, units, attributes, baseContentUnitId);

  return {
    variant_name: values.join(' / '),
    sku: slug([productName || 'PRODUCTO', ...values].join('-')),
    barcode: '',
    base_unit_id: countUnit?.id ?? null,
    sale_mode: 'unit',
    ...content,
    is_active: true,
    is_favorite: false,
    is_principal: false,
    attribute_values: selections,
  };
}

function reconcileVariants(
  current: VariantDraft[],
  attributes: AttributeRow[],
  units: Unit[],
  productName: string,
  baseContentUnitId: number | null,
) {
  const principal = current.find((variant) => variant.is_principal) ?? current[0];
  const protectedPrincipal = principal
    ? {
      ...principal,
      variant_name: principal.sale_mode === 'measured' ? 'Granel' : principal.variant_name,
      attribute_values: [],
      is_active: true,
      is_principal: true,
    }
    : {
      ...newVariant(units, productName, [], attributes, baseContentUnitId),
      variant_name: 'Granel',
      base_unit_id: baseContentUnitId,
      sale_mode: 'measured' as const,
      is_principal: true,
    };

  if (attributes.length === 0) {
    return [{
      ...protectedPrincipal,
        variant_name: '',
        attribute_values: [],
        is_principal: true,
    }];
  }

  const combinations = cartesianProduct(attributes);
  const signatures = new Set(combinations.map(selectionSignature));
  const exactVariants = new Map(
    current
      .filter((variant) => (
        !variant.is_principal
        && signatures.has(selectionSignature(variant.attribute_values))
      ))
      .map((variant) => [selectionSignature(variant.attribute_values), variant]),
  );

  const combinationVariants = combinations.map((selections) => {
    const signature = selectionSignature(selections);
    const existing = exactVariants.get(signature);
    const generated = newVariant(
      units,
      productName,
      selections,
      attributes,
      baseContentUnitId,
    );
    const content = contentFromSelections(selections, units, attributes, baseContentUnitId);

    if (!existing) return generated;

    return {
      ...existing,
      variant_name: selections.map((selection) => selection.value).join(' / '),
      attribute_values: selections,
      content_quantity: content.content_quantity ?? existing.content_quantity,
      content_unit_id: content.content_unit_id ?? existing.content_unit_id,
      is_active: true,
      is_principal: false,
    };
  });

  return [protectedPrincipal, ...combinationVariants];
}

function priceForSelections(selections: AttributeValueSelection[], attributes: AttributeRow[]) {
  let configured = false;
  let total = 0;

  selections.forEach((selection) => {
    const attribute = attributes.find((item) => normalized(item.name) === normalized(selection.attribute));
    const value = attribute?.values.find((item) => normalized(item.value) === normalized(selection.value));
    if (!value || !value.price.trim()) return;

    const parsed = Number(value.price);
    if (!Number.isFinite(parsed)) return;
    configured = true;
    total += parsed;
  });

  return configured && total > 0 ? total : null;
}

function variantPayload(variant: VariantDraft, basePrice: number | null) {
  return {
    id: variant.id,
    variant_name: variant.variant_name || null,
    sku: variant.sku.trim(),
    barcode: variant.barcode.trim() || null,
    base_unit_id: variant.base_unit_id,
    sale_mode: variant.sale_mode,
    content_quantity: variant.sale_mode === 'unit' ? variant.content_quantity || null : null,
    content_unit_id: variant.sale_mode === 'unit' ? variant.content_unit_id : null,
    is_active: variant.is_active,
    is_favorite: variant.is_favorite,
    is_principal: variant.is_principal,
    attribute_values: variant.attribute_values,
    ...(basePrice === null ? {} : { base_price: basePrice }),
  };
}

export function ProductAttributesForm({ templateId }: { templateId?: string }) {
  const [template, setTemplate] = useState<ProductTemplateResponse | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [attributes, setAttributes] = useState<AttributeRow[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      if (!templateId) {
        setError('No se indicó el producto.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const [unitsResponse, templateResponse] = await Promise.all([
          api.get('/units-of-measure'),
          api.get(`/product-templates/${templateId}`),
        ]);
        const loadedTemplate = templateResponse.data.data as ProductTemplateResponse;

        setUnits(unitsResponse.data.data ?? []);
        setTemplate(loadedTemplate);
        setAttributes((loadedTemplate.attributes ?? []).map((attribute) => ({
          key: `attribute-${attribute.id}`,
          name: attribute.name,
          values: attribute.values.map((value) => ({
            key: `value-${value.id}`,
            value: value.value,
            factor: decimal(value.factor),
            price: decimal(value.price),
          })),
          pendingValue: '',
        })));
        setVariants((loadedTemplate.variants ?? []).map((variant, index) => ({
          id: variant.id,
          variant_name: variant.variant_name ?? '',
          sku: variant.sku ?? '',
          barcode: variant.barcode ?? '',
          base_unit_id: variant.base_unit_id,
          sale_mode: variant.sale_mode,
          content_quantity: variant.content_quantity,
          content_unit_id: variant.content_unit_id,
          is_active: variant.is_active ?? true,
          is_favorite: variant.is_favorite ?? false,
          is_principal: variant.is_principal ?? index === 0,
          attribute_values: variant.attribute_values ?? [],
        })));
      } catch (requestError) {
        setError(apiErrorMessage(requestError, 'No se pudieron cargar los atributos.'));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [templateId]);

  const combinationCount = useMemo(
    () => attributes.length === 0
      ? 1
      : attributes.reduce((total, attribute) => total * attribute.values.length, 1),
    [attributes],
  );
  const principalVariant = variants.find((variant) => variant.is_principal) ?? variants[0];
  const principalUnit = units.find((unit) => unit.id === principalVariant?.base_unit_id);

  function addAttribute() {
    setAttributes((current) => [...current, {
      key: draftKey(),
      name: '',
      values: [],
      pendingValue: '',
    }]);
  }

  function updateAttribute(key: string, values: Partial<AttributeRow>) {
    setAttributes((current) => current.map((attribute) => (
      attribute.key === key ? { ...attribute, ...values } : attribute
    )));
  }

  function addAttributeValue(key: string, rawValue?: string) {
    setAttributes((current) => current.map((attribute) => {
      if (attribute.key !== key) return attribute;

      const value = (rawValue ?? attribute.pendingValue).trim();
      if (!value) return { ...attribute, pendingValue: '' };
      if (attribute.values.some((item) => normalized(item.value) === normalized(value))) {
        return { ...attribute, pendingValue: '' };
      }

      return {
        ...attribute,
        values: [...attribute.values, {
          key: draftKey(),
          value,
          factor: suggestedFactor(value, principalUnit),
          price: '',
        }],
        pendingValue: '',
      };
    }));
  }

  function updateAttributeValue(
    attributeKey: string,
    valueKey: string,
    values: Partial<Pick<AttributeValueRow, 'factor' | 'price'>>,
  ) {
    setAttributes((current) => current.map((attribute) => (
      attribute.key === attributeKey
        ? {
          ...attribute,
          values: attribute.values.map((value) => (
            value.key === valueKey ? { ...value, ...values } : value
          )),
        }
        : attribute
    )));
  }

  function removeAttributeValue(attributeKey: string, valueKey: string) {
    setAttributes((current) => current.map((attribute) => (
      attribute.key === attributeKey
        ? { ...attribute, values: attribute.values.filter((item) => item.key !== valueKey) }
        : attribute
    )));
  }

  async function save() {
    if (!template || !templateId) return;
    if (attributes.some((attribute) => !attribute.name.trim() || attribute.values.length === 0)) {
      setError('Cada atributo necesita un nombre y al menos un valor.');
      return;
    }
    if (new Set(attributes.map((attribute) => normalized(attribute.name))).size !== attributes.length) {
      setError('No repitas el mismo atributo.');
      return;
    }
    if (attributes.some((attribute) => attribute.values.some((value) => (
      value.price.trim() !== '' && (!Number.isFinite(Number(value.price)) || Number(value.price) < 0)
    )))) {
      setError('Los precios deben ser números iguales o mayores que cero.');
      return;
    }
    if (attributes.some((attribute) => attribute.values.some((value) => (
      value.factor.trim() !== '' && (!Number.isFinite(Number(value.factor)) || Number(value.factor) <= 0)
    )))) {
      setError('El contenido debe indicarse con números mayores que cero.');
      return;
    }

    const reconciledVariants = reconcileVariants(
      variants,
      attributes,
      units,
      template.name,
      principalVariant?.base_unit_id ?? null,
    );
    if (reconciledVariants.some((variant) => !variant.sku.trim() || !variant.base_unit_id)) {
      setError('No se pudieron preparar correctamente las variantes del producto.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const response = await api.put(`/product-templates/${templateId}`, {
        name: template.name,
        description: template.description,
        default_price: template.default_price,
        is_active: template.is_active,
        is_pos_visible: template.is_pos_visible,
        attributes: attributes.map((attribute) => ({
          name: attribute.name.trim(),
          values: attribute.values.map((value) => value.value),
          value_prices: Object.fromEntries(
            attribute.values.map((value) => [value.value, value.price.trim() || 0]),
          ),
          value_factors: Object.fromEntries(
            attribute.values.map((value) => [value.value, value.factor.trim() || null]),
          ),
        })),
        variants: reconciledVariants.map((variant) => (
          variantPayload(variant, priceForSelections(variant.attribute_values, attributes))
        )),
      });
      const savedTemplate = response.data.data as ProductTemplateResponse;

      setTemplate(savedTemplate);
      setVariants((savedTemplate.variants ?? []).map((variant, index) => ({
        id: variant.id,
        variant_name: variant.variant_name ?? '',
        sku: variant.sku ?? '',
        barcode: variant.barcode ?? '',
        base_unit_id: variant.base_unit_id,
        sale_mode: variant.sale_mode,
        content_quantity: variant.content_quantity,
        content_unit_id: variant.content_unit_id,
        is_active: variant.is_active ?? true,
        is_favorite: variant.is_favorite ?? false,
        is_principal: variant.is_principal ?? index === 0,
        attribute_values: variant.attribute_values ?? [],
      })));
      setMessage('Atributos guardados');
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'No se pudieron guardar los atributos.'));
    } finally {
      setSaving(false);
    }
  }

  if (!PRODUCTS_MODULE) return null;

  return (
    <ModuleLayout module={PRODUCTS_MODULE} selectedItemId="product-list">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        {loading ? (
          <ActivityIndicator color="#B4232D" size="large" style={styles.loader} />
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Button compact icon="arrow-left" mode="text" onPress={() => router.back()}>Volver</Button>
              <Button buttonColor="#FF4D4D" disabled={saving} loading={saving} mode="contained" onPress={() => void save()}>
                Guardar
              </Button>
            </View>

            <Text style={styles.title}>Atributos</Text>
            <Text style={styles.subtitle}>{template?.name ?? 'Producto'}</Text>
            <Text style={styles.factorHelp}>
              {principalUnit
                ? `La variante principal Granel se conserva aparte. Escribe cuánto contiene cada variante. Ejemplo: Contenido: 12 ${contentUnitLabel(principalUnit, '12')}.`
                : 'Selecciona primero la unidad de medida del producto.'}
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.attributeList}>
              {attributes.length === 0 ? (
                <View style={styles.emptyState}>
                  <Icon source="shape-outline" color="#60706E" size={32} />
                  <Text style={styles.emptyTitle}>Aún no hay atributos</Text>
                  <Text style={styles.emptyText}>Agrega uno, por ejemplo Peso, Presentación o Color.</Text>
                </View>
              ) : null}

              {attributes.map((attribute) => (
                <View key={attribute.key} style={styles.attributeCard}>
                  <View style={styles.attributeHeader}>
                    <TextInput
                      dense
                      label="Atributo"
                      mode="flat"
                      onChangeText={(name) => updateAttribute(attribute.key, { name })}
                      placeholder="Ej. Peso"
                      style={styles.attributeInput}
                      value={attribute.name}
                    />
                    <Button
                      compact
                      icon="trash-can-outline"
                      mode="text"
                      textColor="#8F1D2C"
                      onPress={() => setAttributes((current) => current.filter((item) => item.key !== attribute.key))}
                    >
                      Eliminar
                    </Button>
                  </View>

                  <View style={styles.valuesTable}>
                    <View style={styles.valuesHeader}>
                      <Text style={[styles.headerLabel, styles.valueNameColumn]}>VALOR</Text>
                      <Text style={[styles.headerLabel, styles.factorColumn]}>
                        CONTENIDO
                      </Text>
                      <Text style={[styles.headerLabel, styles.priceColumn]}>PRECIO</Text>
                      <View style={styles.valueActionColumn} />
                    </View>

                    {attribute.values.map((value) => (
                      <View key={value.key} style={styles.valueLine}>
                        <Text numberOfLines={2} style={[styles.valueName, styles.valueNameColumn]}>{value.value}</Text>
                        <TextInput
                          dense
                          keyboardType="decimal-pad"
                          mode="flat"
                          onChangeText={(factor) => updateAttributeValue(attribute.key, value.key, { factor })}
                          placeholder="1"
                          right={principalUnit
                            ? <TextInput.Affix text={contentUnitLabel(principalUnit, value.factor)} />
                            : undefined}
                          style={[styles.factorInput, styles.factorColumn]}
                          value={value.factor}
                        />
                        <TextInput
                          dense
                          keyboardType="decimal-pad"
                          left={<TextInput.Affix text="S/" />}
                          mode="flat"
                          onChangeText={(price) => updateAttributeValue(attribute.key, value.key, { price })}
                          placeholder="0.00"
                          style={[styles.priceInput, styles.priceColumn]}
                          value={value.price}
                        />
                        <Pressable
                          accessibilityLabel={`Quitar ${value.value}`}
                          hitSlop={8}
                          onPress={() => removeAttributeValue(attribute.key, value.key)}
                          style={({ pressed }) => [styles.removeButton, pressed && styles.removeButtonPressed]}
                        >
                          <Icon source="close" color="#8F1D2C" size={18} />
                        </Pressable>
                      </View>
                    ))}

                    <View style={styles.addValueRow}>
                      <TextInput
                        blurOnSubmit={false}
                        dense
                        mode="flat"
                        onBlur={(event) => addAttributeValue(attribute.key, event.nativeEvent.text)}
                        onChangeText={(pendingValue) => updateAttribute(attribute.key, { pendingValue })}
                        onSubmitEditing={(event) => addAttributeValue(attribute.key, event.nativeEvent.text)}
                        placeholder={attribute.values.length === 0 ? 'Ej. 1 kg' : 'Nuevo valor'}
                        style={styles.valueInput}
                        value={attribute.pendingValue}
                      />
                      <Button
                        compact
                        icon="plus"
                        mode="text"
                        onPress={() => addAttributeValue(attribute.key)}
                      >
                        Agregar valor
                      </Button>
                    </View>
                  </View>
                </View>
              ))}

              <Pressable onPress={addAttribute} style={({ pressed }) => [styles.addAttribute, pressed && styles.addRowPressed]}>
                <Icon source="plus" color="#B4232D" size={19} />
                <Text style={styles.addRowText}>Agregar atributo</Text>
              </Pressable>
            </View>

            <Text style={styles.summary}>
              {attributes.length === 0
                ? 'Producto sin atributos'
                : `${attributes.length} atributo(s) · Principal Granel + ${combinationCount} combinación(es)`}
            </Text>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
      <Snackbar duration={2200} onDismiss={() => setMessage('')} visible={Boolean(message)}>{message}</Snackbar>
    </ModuleLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' },
  loader: { flex: 1 },
  content: { width: '100%', maxWidth: 1050, alignSelf: 'center', padding: 20, paddingBottom: 56 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { marginTop: 18, color: '#172423', fontSize: 24, fontWeight: '800' },
  subtitle: { marginTop: 3, color: '#60706E', fontSize: 13 },
  factorHelp: { marginTop: 5, color: '#71807D', fontSize: 10 },
  error: { marginTop: 14, padding: 12, borderRadius: 8, color: '#8F1D2C', backgroundColor: '#FCE8EA' },
  attributeList: { marginTop: 26, gap: 14 },
  attributeCard: { overflow: 'hidden', borderWidth: 1, borderColor: '#CCD7D4', borderRadius: 10, backgroundColor: '#FFFFFF' },
  attributeHeader: { minHeight: 56, paddingHorizontal: 12, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F6F8F7' },
  attributeInput: { flex: 1, minWidth: 0, backgroundColor: 'transparent', fontSize: 14 },
  valuesTable: { borderTopWidth: 1, borderTopColor: '#DDE5E3' },
  valuesHeader: { minHeight: 34, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EAEFEE' },
  headerLabel: { color: '#4E5D5A', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  valueNameColumn: { flex: 1, minWidth: 0 },
  factorColumn: { width: 112 },
  priceColumn: { width: 96 },
  valueActionColumn: { width: 28 },
  valueLine: { minHeight: 48, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#EDF1F0' },
  valueName: { color: '#263431', fontSize: 13, fontWeight: '700' },
  valueInput: { flex: 1, minWidth: 0, backgroundColor: 'transparent', fontSize: 12 },
  factorInput: { backgroundColor: 'transparent', fontSize: 11 },
  priceInput: { backgroundColor: 'transparent', fontSize: 12 },
  removeButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17 },
  removeButtonPressed: { backgroundColor: '#FCE8EA' },
  addValueRow: { minHeight: 52, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: '#EDF1F0' },
  addAttribute: { minHeight: 48, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderStyle: 'dashed', borderColor: '#B8C6C3', borderRadius: 10, backgroundColor: '#FFFFFF' },
  addRowPressed: { backgroundColor: '#F6F8F7' },
  addRowText: { color: '#B4232D', fontSize: 12, fontWeight: '800' },
  emptyState: { padding: 24, alignItems: 'center', gap: 6, borderWidth: 1, borderStyle: 'dashed', borderColor: '#B8C6C3', borderRadius: 10, backgroundColor: '#FFFFFF' },
  emptyTitle: { color: '#172423', fontSize: 14, fontWeight: '800' },
  emptyText: { color: '#60706E', fontSize: 11, textAlign: 'center' },
  summary: { marginTop: 10, color: '#60706E', fontSize: 11 },
});
