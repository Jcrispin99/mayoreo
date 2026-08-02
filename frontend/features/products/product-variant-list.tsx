import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Icon, Text } from 'react-native-paper';
import { ModuleLayout } from '../../components/module/module-layout';
import { getVisibleMenu } from '../../config/menu';
import { api, apiErrorMessage } from '../../lib/api';

type ProductVariant = {
  id: number;
  variant_name: string | null;
  display_name: string;
  sku: string;
  barcode: string | null;
  is_active: boolean;
  is_principal: boolean;
  attribute_values: Array<{
    attribute: string;
    value: string;
  }>;
  price_tiers: Array<{
    min_quantity: string | number;
    unit_price: string | number;
    is_active: boolean;
  }>;
};

type ProductTemplate = {
  id: number;
  name: string;
  variants: ProductVariant[];
};

const PRODUCTS_MODULE = getVisibleMenu().find((module) => module.id === 'inventory');

function basePrice(variant: ProductVariant) {
  const tier = variant.price_tiers
    .filter((item) => item.is_active)
    .sort((first, second) => Number(first.min_quantity) - Number(second.min_quantity))[0];
  if (!tier) return 'Sin precio';

  return `S/ ${new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(tier.unit_price))}`;
}

function variantLabel(variant: ProductVariant) {
  if (variant.attribute_values.length === 0) return 'Variante principal';
  return variant.attribute_values
    .map((selection) => `${selection.attribute}: ${selection.value}`)
    .join(' · ');
}

export function ProductVariantList({ templateId }: { templateId?: string }) {
  const [template, setTemplate] = useState<ProductTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        const response = await api.get(`/product-templates/${templateId}`);
        setTemplate(response.data.data as ProductTemplate);
      } catch (requestError) {
        setError(apiErrorMessage(requestError, 'No se pudieron cargar las variantes.'));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [templateId]);

  if (!PRODUCTS_MODULE) return null;

  return (
    <ModuleLayout module={PRODUCTS_MODULE} selectedItemId="product-list">
      {loading ? (
        <ActivityIndicator color="#B4232D" size="large" style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Button compact icon="arrow-left" mode="text" onPress={() => router.back()}>
            Volver
          </Button>

          <Text style={styles.title}>Variantes</Text>
          <Text style={styles.subtitle}>{template?.name ?? 'Producto'}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.list}>
            {(template?.variants ?? []).map((variant) => (
              <View key={variant.id} style={styles.variantCard}>
                <View style={styles.variantHeader}>
                  <View style={styles.variantIdentity}>
                    <Text style={styles.variantName}>
                      {variant.variant_name || variant.display_name || 'Variante principal'}
                    </Text>
                    <Text style={styles.attributeValues}>{variantLabel(variant)}</Text>
                  </View>
                  {variant.is_principal ? (
                    <View style={styles.principalBadge}>
                      <Icon source="star-circle" color="#B4232D" size={17} />
                      <Text style={styles.principalText}>Principal</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.details}>
                  <View style={styles.detail}>
                    <Text style={styles.detailLabel}>SKU</Text>
                    <Text numberOfLines={1} style={styles.detailValue}>{variant.sku}</Text>
                  </View>
                  <View style={styles.detail}>
                    <Text style={styles.detailLabel}>CÓDIGO DE BARRAS</Text>
                    <Text numberOfLines={1} style={styles.detailValue}>{variant.barcode || 'Sin código'}</Text>
                  </View>
                  <View style={styles.detail}>
                    <Text style={styles.detailLabel}>PRECIO BASE</Text>
                    <Text style={styles.price}>{basePrice(variant)}</Text>
                  </View>
                </View>
              </View>
            ))}

            {!error && (template?.variants.length ?? 0) === 0 ? (
              <View style={styles.emptyState}>
                <Icon source="package-variant-closed" color="#60706E" size={34} />
                <Text style={styles.emptyTitle}>Sin variantes</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}
    </ModuleLayout>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1 },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 20, paddingBottom: 56 },
  title: { marginTop: 14, color: '#172423', fontSize: 24, fontWeight: '800' },
  subtitle: { marginTop: 3, color: '#60706E', fontSize: 13 },
  error: { marginTop: 14, padding: 12, borderRadius: 8, color: '#8F1D2C', backgroundColor: '#FCE8EA' },
  list: { marginTop: 24, gap: 12 },
  variantCard: { padding: 16, gap: 15, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 12, backgroundColor: '#FFFFFF' },
  variantHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  variantIdentity: { flex: 1, minWidth: 0 },
  variantName: { color: '#172423', fontSize: 15, fontWeight: '900' },
  attributeValues: { marginTop: 4, color: '#60706E', fontSize: 11 },
  principalBadge: { paddingVertical: 5, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, backgroundColor: '#FCE8EA' },
  principalText: { color: '#8F1D2C', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  details: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  detail: { minWidth: 130, flexGrow: 1 },
  detailLabel: { color: '#71807D', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  detailValue: { marginTop: 4, color: '#263431', fontSize: 12, fontWeight: '700' },
  price: { marginTop: 4, color: '#B4232D', fontSize: 13, fontWeight: '900' },
  emptyState: { padding: 28, alignItems: 'center', gap: 7, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C7D2D0', borderRadius: 12 },
  emptyTitle: { color: '#172423', fontSize: 13, fontWeight: '800' },
});
