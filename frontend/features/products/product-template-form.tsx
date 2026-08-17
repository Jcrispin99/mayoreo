import * as ImagePicker from 'expo-image-picker';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Icon, Menu, Snackbar, Switch, Text, TextInput } from 'react-native-paper';
import { ModuleLayout } from '../../components/module/module-layout';
import { getVisibleMenu } from '../../config/menu';
import { api, apiErrorMessage } from '../../lib/api';
import { ProductImageField } from './product-image-field';
import { useProductImagePicker } from './use-product-image-picker';

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

type ProductAttribute = {
  name: string;
  values: string[];
  value_prices: Record<string, string | number>;
  value_factors: Record<string, string | number | null>;
};

type ProductVariant = {
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
  image_url: string | null;
  is_active: boolean;
  is_pos_visible: boolean;
  attributes: Array<{
    name: string;
    values: Array<{ value: string; price: string | number; factor: string | number | null }>;
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
    image_url: string | null;
  }>;
};

const PRODUCTS_MODULE = getVisibleMenu().find((module) => module.id === 'inventory');
function slug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
}

function variantPayload(
  variant: ProductVariant,
  fallbackSku: string,
  principalBarcode: string,
  principalBaseUnitId: number,
  principalSaleMode: 'unit' | 'measured',
) {
  const saleMode = variant.is_principal ? principalSaleMode : variant.sale_mode;

  return {
    id: variant.id,
    variant_name: variant.variant_name || null,
    sku: variant.sku.trim() || fallbackSku,
    barcode: (variant.is_principal ? principalBarcode : variant.barcode).trim() || null,
    base_unit_id: variant.is_principal ? principalBaseUnitId : variant.base_unit_id,
    sale_mode: saleMode,
    content_quantity: saleMode === 'unit' ? variant.content_quantity || null : null,
    content_unit_id: saleMode === 'unit' ? variant.content_unit_id : null,
    is_active: variant.is_active,
    is_favorite: variant.is_favorite,
    is_principal: variant.is_principal,
    attribute_values: variant.attribute_values,
  };
}

export function ProductTemplateForm({ templateId }: { templateId?: string }) {
  const editing = Boolean(templateId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [posVisible, setPosVisible] = useState(true);
  const [units, setUnits] = useState<Unit[]>([]);
  const [baseUnitId, setBaseUnitId] = useState<number | null>(null);
  const [unitMenuVisible, setUnitMenuVisible] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [attributes, setAttributes] = useState<ProductAttribute[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const {
    chooseFromLibrary,
    selectedImage,
    setSelectedImage,
    takePhoto,
  } = useProductImagePicker({ onError: setError });

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');

      try {
        const unitsResponse = await api.get('/units-of-measure');
        const units = (unitsResponse.data.data ?? []) as Unit[];
        const countUnit = units.find((unit) => unit.type === 'count') ?? units[0];
        setUnits(units);

        if (!templateId) {
          setBaseUnitId(countUnit?.id ?? null);
          setVariants([{
            variant_name: '',
            sku: '',
            barcode: '',
            base_unit_id: countUnit?.id ?? null,
            sale_mode: 'unit',
            content_quantity: null,
            content_unit_id: null,
            is_active: true,
            is_favorite: false,
            is_principal: true,
            attribute_values: [],
          }]);
          return;
        }

        const response = await api.get(`/product-templates/${templateId}`);
        const template = response.data.data as ProductTemplateResponse;
        setName(template.name ?? '');
        setDescription(template.description ?? '');
        setActive(template.is_active ?? true);
        setPosVisible(template.is_pos_visible ?? true);
        setImageUrl(template.image_url ?? null);
        const principal = template.variants.find((variant) => variant.is_principal) ?? template.variants[0];
        setBaseUnitId(principal?.base_unit_id ?? countUnit?.id ?? null);
        setBarcode(principal?.barcode ?? '');
        setAttributes((template.attributes ?? []).map((attribute) => ({
          name: attribute.name,
          values: attribute.values.map((value) => value.value),
          value_prices: Object.fromEntries(
            attribute.values.map((value) => [value.value, value.price]),
          ),
          value_factors: Object.fromEntries(
            attribute.values.map((value) => [value.value, value.factor]),
          ),
        })));
        setVariants((template.variants ?? []).map((variant, index) => ({
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
        setError(apiErrorMessage(requestError, 'No se pudo cargar el producto.'));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [templateId]);

  const selectedUnit = units.find((unit) => unit.id === baseUnitId);

  async function uploadImage(productId: number, image: ImagePicker.ImagePickerAsset) {
    const formData = new FormData();
    const fileName = image.fileName ?? `producto-${productId}.jpg`;

    if (Platform.OS === 'web') {
      const imageResponse = await fetch(image.uri);
      const blob = await imageResponse.blob();
      formData.append('image', blob, fileName);
    } else {
      formData.append('image', {
        uri: image.uri,
        name: fileName,
        type: image.mimeType ?? 'image/jpeg',
      } as unknown as Blob);
    }

    const response = await api.post(`/products/${productId}/image`, formData);
    setImageUrl(response.data.data.image_url ?? image.uri);
    setSelectedImage(null);
  }

  async function save() {
    const productName = name.trim();
    if (!productName) {
      setError('Ingresa el nombre del producto.');
      return;
    }
    if (!baseUnitId || variants.length === 0 || variants.some((variant) => !variant.base_unit_id)) {
      setError('No se encontró una unidad válida para el producto.');
      return;
    }
    setSaving(true);
    setError('');

    try {
      const payload = {
        name: productName,
        description: description.trim() || null,
        is_active: active,
        is_pos_visible: posVisible,
        attributes,
        variants: variants.map((variant, index) => (
          variantPayload(
            variant,
            `${slug(productName) || 'PRODUCTO'}${index > 0 ? `-${index + 1}` : ''}`,
            barcode,
            baseUnitId,
            selectedUnit?.type === 'count' ? 'unit' : 'measured',
          )
        )),
      };
      const response = editing
        ? await api.put(`/product-templates/${templateId}`, payload)
        : await api.post('/product-templates', payload);
      const saved = response.data.data as ProductTemplateResponse;
      const principal = saved.variants.find((variant) => variant.is_principal) ?? saved.variants[0];

      if (selectedImage && principal) {
        await uploadImage(principal.id, selectedImage);
      }

      setMessage(editing ? 'Producto actualizado' : 'Producto creado');
      if (!editing) {
        router.replace({
          pathname: '/products/[productId]',
          params: { productId: String(saved.id) },
        } as Href);
      }
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'No se pudo guardar el producto.'));
    } finally {
      setSaving(false);
    }
  }

  function openAttributes() {
    if (!templateId) return;
    router.push({
      pathname: '/products/attributes',
      params: { templateId },
    } as Href);
  }

  function openVariants() {
    if (!templateId) return;
    router.push({
      pathname: '/products/variants',
      params: { templateId },
    } as Href);
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

            {editing ? (
              <View style={styles.editActions}>
                <Button icon="shape-outline" mode="outlined" onPress={openAttributes}>
                  Atributos
                </Button>
                <Button icon="package-variant-closed" mode="outlined" onPress={openVariants}>
                  Variantes
                </Button>
              </View>
            ) : (
              <Text style={styles.title}>Nuevo producto</Text>
            )}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.identitySection}>
              <View style={styles.identityFields}>
                <TextInput
                  label="Nombre del producto *"
                  mode="flat"
                  onChangeText={setName}
                  style={[styles.input, styles.nameInput]}
                  value={name}
                />
                <Text style={styles.imageHelp}>Toca la imagen para agregarla o cambiarla.</Text>
              </View>
              <ProductImageField
                disabled={saving}
                imageUri={selectedImage?.uri ?? imageUrl}
                onChooseFromLibrary={() => void chooseFromLibrary()}
                onTakePhoto={() => void takePhoto()}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Información general</Text>
              <View>
                <Text style={styles.fieldLabel}>Unidad de medida *</Text>
                <Menu
                  anchor={(
                    <Pressable onPress={() => setUnitMenuVisible(true)} style={styles.selector}>
                      <Text style={styles.selectorText}>
                        {selectedUnit ? `${selectedUnit.name} (${selectedUnit.code})` : 'Seleccionar unidad'}
                      </Text>
                      <Icon source="chevron-down" color="#60706E" size={20} />
                    </Pressable>
                  )}
                  onDismiss={() => setUnitMenuVisible(false)}
                  visible={unitMenuVisible}
                >
                  {units.map((unit) => (
                    <Menu.Item
                      key={unit.id}
                      leadingIcon={unit.id === baseUnitId ? 'check' : undefined}
                      onPress={() => {
                        setBaseUnitId(unit.id);
                        setUnitMenuVisible(false);
                      }}
                      title={`${unit.name} (${unit.code})`}
                    />
                  ))}
                </Menu>
              </View>
              <TextInput
                keyboardType="numeric"
                label="Código de barras"
                mode="flat"
                onChangeText={setBarcode}
                style={styles.input}
                value={barcode}
              />
              <Text style={styles.help}>
                Este código pertenece a la variante principal del producto.
              </Text>
              <TextInput
                label="Descripción"
                mode="flat"
                multiline
                numberOfLines={3}
                onChangeText={setDescription}
                style={styles.input}
                value={description}
              />
              <View style={styles.switchRow}>
                <Text style={styles.switchTitle}>Producto activo</Text>
                <Switch onValueChange={setActive} value={active} />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchTitle}>Visible en POS</Text>
                <Switch onValueChange={setPosVisible} value={posVisible} />
              </View>
            </View>
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
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 20, paddingBottom: 56 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editActions: { marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  title: { marginTop: 18, color: '#172423', fontSize: 24, fontWeight: '800' },
  error: { marginTop: 14, padding: 12, borderRadius: 8, color: '#8F1D2C', backgroundColor: '#FCE8EA' },
  identitySection: { marginTop: 22, flexDirection: 'row', alignItems: 'center' },
  identityFields: { flex: 1, minWidth: 0, marginRight: 18 },
  nameInput: { fontSize: 20 },
  imageHelp: { marginTop: 7, color: '#60706E', fontSize: 10 },
  section: { marginTop: 28, gap: 18 },
  sectionTitle: { color: '#172423', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  input: { backgroundColor: 'transparent' },
  help: { marginTop: -12, color: '#60706E', fontSize: 10 },
  fieldLabel: { marginBottom: 2, color: '#60706E', fontSize: 11 },
  selector: { minHeight: 48, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#879692' },
  selectorText: { flex: 1, color: '#172423', fontSize: 14 },
  switchRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchTitle: { color: '#172423', fontSize: 13, fontWeight: '800' },
});
