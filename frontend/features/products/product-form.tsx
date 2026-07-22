import * as ImagePicker from 'expo-image-picker';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Icon, Menu, Snackbar, Switch, Text, TextInput } from 'react-native-paper';
import { ModuleLayout } from '../../components/module/module-layout';
import { getVisibleMenu } from '../../config/menu';
import { api } from '../../lib/api';
import { ProductImageField } from './product-image-field';

type Unit = { id: number; code: string; name: string };
type ProductFormProps = { productId?: string };

const PRODUCTS_MODULE = getVisibleMenu().find((module) => module.id === 'inventory');
const MAX_IMAGE_SIZE = 4 * 1024 * 1024;

export function ProductForm({ productId }: ProductFormProps) {
  const editing = Boolean(productId);
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseUnitId, setBaseUnitId] = useState<number | null>(null);
  const [active, setActive] = useState(true);
  const [favorite, setFavorite] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitMenuVisible, setUnitMenuVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedUnit = units.find((unit) => unit.id === baseUnitId);
  const displayedImage = selectedImage?.uri ?? imageUrl;

  useEffect(() => {
    async function loadForm() {
      setLoading(true);
      setError('');
      try {
        const [unitsResponse, productResponse] = await Promise.all([
          api.get('/units-of-measure'),
          productId ? api.get(`/products/${productId}`) : Promise.resolve(null),
        ]);
        const availableUnits: Unit[] = unitsResponse.data.data ?? [];
        setUnits(availableUnits);

        if (productResponse) {
          const product = productResponse.data.data;
          setSku(product.sku ?? '');
          setBarcode(product.barcode ?? '');
          setName(product.name ?? '');
          setDescription(product.description ?? '');
          setBaseUnitId(product.base_unit_id ?? null);
          setActive(product.is_active ?? true);
          setFavorite(product.is_favorite ?? false);
          setImageUrl(product.image_url ?? null);
        } else if (availableUnits[0]) {
          setBaseUnitId(availableUnits[0].id);
        }
      } catch {
        setError('No se pudo cargar la información del producto.');
      } finally {
        setLoading(false);
      }
    }

    void loadForm();
  }, [productId]);

  async function pickImage() {
    setError('');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) return;

    const image = result.assets[0];
    if (image.fileSize && image.fileSize > MAX_IMAGE_SIZE) {
      setError('La imagen debe pesar como máximo 4 MB.');
      return;
    }

    setSelectedImage(image);
  }

  async function uploadImage(savedProductId: number, image: ImagePicker.ImagePickerAsset) {
    const formData = new FormData();
    const fileName = image.fileName ?? `producto-${savedProductId}.jpg`;

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

    const response = await api.post(`/products/${savedProductId}/image`, formData);
    setImageUrl(response.data.data.image_url ?? image.uri);
    setSelectedImage(null);
  }

  async function save() {
    if (!sku.trim() || !name.trim() || !baseUnitId) {
      setError('Completa SKU, nombre y unidad de medida.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        sku: sku.trim(),
        barcode: barcode.trim() || null,
        name: name.trim(),
        description: description.trim() || null,
        base_unit_id: baseUnitId,
        is_active: active,
        is_favorite: favorite,
      };
      const response = editing ? await api.put(`/products/${productId}`, payload) : await api.post('/products', payload);
      const savedId = Number(response.data.data.id);

      if (selectedImage) await uploadImage(savedId, selectedImage);

      setMessage(editing ? 'Producto actualizado' : 'Producto creado');
      if (!editing) {
        router.replace({ pathname: '/products/[productId]', params: { productId: String(savedId) } } as Href);
      }
    } catch (requestError: any) {
      const validationErrors = requestError?.response?.data?.errors;
      const firstValidationError = validationErrors ? Object.values(validationErrors).flat()[0] : null;
      setError(typeof firstValidationError === 'string' ? firstValidationError : 'No se pudo guardar el producto.');
    } finally {
      setSaving(false);
    }
  }

  function openKardex() {
    if (!productId) return;
    router.push({
      pathname: '/inventory/movements',
      params: { productId, flow: 'all' },
    } as Href);
  }

  if (!PRODUCTS_MODULE) return null;

  return (
    <ModuleLayout module={PRODUCTS_MODULE} selectedItemId="product-list">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        {loading ? (
          <ActivityIndicator color="#73547B" size="large" style={styles.loader} />
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.formHeader}>
              <Button compact icon="arrow-left" mode="text" onPress={() => router.back()}>
                Volver
              </Button>
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

            {editing ? (
              <View style={styles.movementActions}>
                <Button compact icon="swap-vertical" mode="outlined" onPress={openKardex}>Movimientos</Button>
              </View>
            ) : null}

            <Text style={styles.title}>{editing ? 'Editar producto' : 'Nuevo producto'}</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.identitySection}>
              <View style={styles.identityFields}>
                <View style={styles.nameRow}>
                  <Pressable
                    accessibilityLabel={favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => setFavorite((current) => !current)}
                    style={styles.favoriteButton}
                  >
                    <Icon source={favorite ? 'star' : 'star-outline'} color={favorite ? '#D18A25' : '#817986'} size={27} />
                  </Pressable>
                  <TextInput
                    label="Nombre del producto *"
                    mode="flat"
                    onChangeText={setName}
                    style={[styles.input, styles.nameInput]}
                    underlineColor="#CFC7D1"
                    activeUnderlineColor="#73547B"
                    value={name}
                  />
                </View>
                <Text style={styles.imageHelp}>Toca la imagen para agregarla o cambiarla.</Text>
              </View>
              <ProductImageField disabled={saving} imageUri={displayedImage} onPress={() => void pickImage()} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Información general</Text>
              <TextInput
                autoCapitalize="characters"
                label="SKU *"
                mode="flat"
                onChangeText={setSku}
                style={styles.input}
                underlineColor="#CFC7D1"
                activeUnderlineColor="#73547B"
                value={sku}
              />
              <TextInput
                keyboardType="numeric"
                label="Código de barras"
                mode="flat"
                onChangeText={setBarcode}
                style={styles.input}
                underlineColor="#CFC7D1"
                activeUnderlineColor="#73547B"
                value={barcode}
              />

              <View>
                <Text style={styles.fieldLabel}>Unidad de medida *</Text>
                <Menu
                  anchor={
                    <Pressable
                      accessibilityLabel="Seleccionar unidad de medida"
                      accessibilityRole="button"
                      onPress={() => setUnitMenuVisible(true)}
                      style={styles.selector}
                    >
                      <Text style={[styles.selectorText, !selectedUnit && styles.placeholderText]}>
                        {selectedUnit ? `${selectedUnit.name} (${selectedUnit.code})` : 'Seleccionar unidad'}
                      </Text>
                      <Icon source="chevron-down" color="#746C78" size={21} />
                    </Pressable>
                  }
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
                label="Descripción"
                mode="flat"
                multiline
                numberOfLines={3}
                onChangeText={setDescription}
                style={[styles.input, styles.descriptionInput]}
                underlineColor="#CFC7D1"
                activeUnderlineColor="#73547B"
                value={description}
              />

              <View style={styles.switchRow}>
                <View style={styles.switchCopy}>
                  <Text style={styles.switchTitle}>Producto activo</Text>
                  <Text style={styles.switchDescription}>Disponible para compras, ventas e inventario.</Text>
                </View>
                <Switch onValueChange={setActive} value={active} />
              </View>
            </View>

          </ScrollView>
        )}
      </KeyboardAvoidingView>
      <Snackbar duration={2200} onDismiss={() => setMessage('')} visible={Boolean(message)}>
        {message}
      </Snackbar>
    </ModuleLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAF9FA' },
  loader: { flex: 1 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  movementActions: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  title: { marginTop: 18, color: '#28222C', fontSize: 24, fontWeight: '800' },
  error: { marginTop: 14, padding: 12, borderRadius: 8, color: '#923E4E', backgroundColor: '#FBEAEC' },
  identitySection: { marginTop: 18, flexDirection: 'row', alignItems: 'center' },
  identityFields: { flex: 1, marginRight: 18 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  favoriteButton: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
  nameInput: { flex: 1, fontSize: 20 },
  imageHelp: { marginTop: 7, marginLeft: 38, color: '#8A818D', fontSize: 10 },
  section: { marginTop: 30, gap: 18 },
  sectionTitle: {
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#E0DAE2',
    color: '#4A414E',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: { backgroundColor: 'transparent' },
  descriptionInput: { minHeight: 88 },
  fieldLabel: { marginBottom: 2, color: '#777079', fontSize: 11 },
  selector: {
    minHeight: 48,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#CFC7D1',
  },
  selectorText: { flex: 1, color: '#302A33', fontSize: 15 },
  placeholderText: { color: '#807984' },
  switchRow: {
    minHeight: 64,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#D8D1DA',
  },
  switchCopy: { flex: 1, marginRight: 12 },
  switchTitle: { color: '#413A44', fontSize: 14, fontWeight: '700' },
  switchDescription: { marginTop: 3, color: '#8A838D', fontSize: 10 },
});
