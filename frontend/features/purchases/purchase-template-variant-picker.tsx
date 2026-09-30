import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Icon, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, apiErrorMessage } from '../../lib/api';
import { pickDefaultVariant } from './purchase-variant-selection';
import type { Product, ProductTemplate, ProductTemplatePage } from './purchase-types';

type PurchaseTemplateVariantPickerProps = {
  visible: boolean;
  selectedProductId: number | null;
  onClose: () => void;
  onConfirm: (product: Product) => void;
};

const PAGE_SIZE = 12;

export function PurchaseTemplateVariantPicker({
  visible,
  selectedProductId,
  onClose,
  onConfirm,
}: PurchaseTemplateVariantPickerProps) {
  const [templates, setTemplates] = useState<ProductTemplate[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<ProductTemplate | null>(null);
  const [pendingProductId, setPendingProductId] = useState<number | null>(selectedProductId);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (!visible) return;
    setActiveTemplate(null);
    setPendingProductId(selectedProductId);
    setQuery('');
    setDebouncedQuery('');
  }, [selectedProductId, visible]);

  useEffect(() => {
    if (!visible) return;

    const controller = new AbortController();
    setLoading(true);
    setError('');
    void api.get('/product-templates', {
      params: { picker: true, search: debouncedQuery || undefined, page: 1, per_page: PAGE_SIZE },
      signal: controller.signal,
    }).then((response) => {
      const result: ProductTemplatePage = response.data.data;
      setTemplates(result.items ?? []);
      setPage(result.pagination.current_page);
      setLastPage(result.pagination.last_page);
      setTotal(result.pagination.total);
    }).catch((requestError) => {
      if (requestError?.code !== 'ERR_CANCELED') {
        setError(apiErrorMessage(requestError, 'No se pudieron cargar los productos.'));
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });

    return () => controller.abort();
  }, [debouncedQuery, visible]);

  async function loadMore() {
    if (loadingMore || page >= lastPage) return;
    setLoadingMore(true);
    setError('');
    try {
      const response = await api.get('/product-templates', {
        params: { picker: true, search: debouncedQuery || undefined, page: page + 1, per_page: PAGE_SIZE },
      });
      const result: ProductTemplatePage = response.data.data;
      setTemplates((current) => [
        ...current,
        ...(result.items ?? []).filter((item) => !current.some((existing) => existing.id === item.id)),
      ]);
      setPage(result.pagination.current_page);
      setLastPage(result.pagination.last_page);
      setTotal(result.pagination.total);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'No se pudieron cargar más productos.'));
    } finally {
      setLoadingMore(false);
    }
  }

  function selectTemplate(template: ProductTemplate) {
    const selectedVariant = template.variants.find((variant) => variant.id === selectedProductId);
    const defaultVariant = selectedVariant ?? pickDefaultVariant(template.variants);
    setPendingProductId(defaultVariant?.id ?? null);
    setActiveTemplate(template);
  }

  function confirmVariant() {
    const product = activeTemplate?.variants.find((variant) => variant.id === pendingProductId);
    if (!product) return;
    onConfirm(product);
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.header}>
          {activeTemplate ? (
            <Pressable accessibilityLabel="Volver a productos" hitSlop={8} onPress={() => setActiveTemplate(null)} style={styles.headerButton}>
              <Icon color="#172423" size={22} source="arrow-left" />
            </Pressable>
          ) : <View style={styles.headerButton} />}
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.title}>{activeTemplate ? activeTemplate.name : 'Seleccionar producto'}</Text>
            <Text numberOfLines={1} style={styles.subtitle}>
              {activeTemplate ? 'Paso 2 de 2 · Elige la variante' : 'Paso 1 de 2 · Elige el producto'}
            </Text>
          </View>
          <Pressable accessibilityLabel="Cerrar selector" hitSlop={8} onPress={onClose} style={styles.headerButton}>
            <Icon color="#172423" size={22} source="close" />
          </Pressable>
        </View>

        {activeTemplate ? (
          <>
            <Text style={styles.variantHelp}>La variante sugerida queda marcada por defecto. Puedes elegir otra antes de continuar.</Text>
            <FlatList
              contentContainerStyle={styles.listContent}
              data={activeTemplate.variants}
              keyExtractor={(variant) => String(variant.id)}
              renderItem={({ item: variant }) => {
                const selected = variant.id === pendingProductId;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => setPendingProductId(variant.id)}
                    style={[styles.row, selected && styles.rowSelected]}
                  >
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>{variant.variant_name || 'Producto base'}</Text>
                      <Text style={styles.rowMeta}>{variant.sku} · {variant.base_unit?.name ?? 'Sin unidad'}</Text>
                    </View>
                    <Icon color={selected ? '#B4232D' : '#879692'} size={22} source={selected ? 'radiobox-marked' : 'radiobox-blank'} />
                  </Pressable>
                );
              }}
            />
            <View style={styles.footer}>
              <Button buttonColor="#FF4D4D" disabled={!pendingProductId} mode="contained" onPress={confirmVariant}>
                Usar esta variante
              </Button>
            </View>
          </>
        ) : (
          <>
            <View style={styles.searchBox}>
              <TextInput
                autoFocus
                dense
                left={<TextInput.Icon icon="magnify" />}
                mode="outlined"
                onChangeText={setQuery}
                placeholder="Buscar producto, SKU o código"
                value={query}
              />
              {!loading ? <Text style={styles.resultCount}>{total} producto{total === 1 ? '' : 's'}</Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
            {loading ? (
              <ActivityIndicator color="#B4232D" size="large" style={styles.loader} />
            ) : (
              <FlatList
                contentContainerStyle={styles.listContent}
                data={templates}
                keyboardShouldPersistTaps="handled"
                keyExtractor={(template) => String(template.id)}
                ListEmptyComponent={<Text style={styles.empty}>No se encontraron productos.</Text>}
                ListFooterComponent={page < lastPage ? (
                  <Button compact loading={loadingMore} mode="text" onPress={() => void loadMore()} textColor="#B4232D">
                    Cargar más
                  </Button>
                ) : null}
                renderItem={({ item: template }) => (
                  <Pressable onPress={() => selectTemplate(template)} style={styles.row}>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>{template.name}</Text>
                      <Text style={styles.rowMeta}>
                        {template.variants.length} variante{template.variants.length === 1 ? '' : 's'}
                      </Text>
                    </View>
                    <Icon color="#60706E" size={21} source="chevron-right" />
                  </Pressable>
                )}
              />
            )}
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F9F8' },
  header: { minHeight: 62, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#D7E0DE', backgroundColor: '#FFFFFF' },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, alignItems: 'center' },
  title: { color: '#172423', fontSize: 16, fontWeight: '900' },
  subtitle: { marginTop: 2, color: '#60706E', fontSize: 10 },
  searchBox: { padding: 14, gap: 7, backgroundColor: '#FFFFFF' },
  resultCount: { color: '#60706E', fontSize: 10 },
  error: { padding: 10, color: '#8F1D2C', backgroundColor: '#FCE8EA' },
  loader: { flex: 1 },
  listContent: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 14, gap: 9, paddingBottom: 28 },
  row: { minHeight: 64, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#D7E0DE', borderRadius: 11, backgroundColor: '#FFFFFF' },
  rowSelected: { borderColor: '#B4232D', backgroundColor: '#FCE8EA' },
  rowCopy: { flex: 1 },
  rowTitle: { color: '#172423', fontSize: 14, fontWeight: '800' },
  rowMeta: { marginTop: 3, color: '#60706E', fontSize: 11 },
  empty: { paddingVertical: 40, textAlign: 'center', color: '#60706E' },
  variantHelp: { paddingHorizontal: 18, paddingTop: 16, color: '#60706E', fontSize: 11, lineHeight: 16 },
  footer: { padding: 14, borderTopWidth: 1, borderTopColor: '#D7E0DE', backgroundColor: '#FFFFFF' },
});
