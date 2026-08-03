import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { ActivityIndicator, Button, Icon, Text } from 'react-native-paper';
import { ListSearch, type ListFilterOption } from '../../components/data/list-search';
import { api } from '../../lib/api';
import { usePriceNotifications } from '../../lib/price-notifications-context';
import { catalogPriceSummary } from './pos-measurement';
import type { PosCatalogProduct } from './pos-types';

const CATALOG_PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 300;

const FILTER_OPTIONS: ListFilterOption[] = [
  { id: 'favorite', label: 'Favoritos', group: 'Producto', icon: 'star-outline' },
  { id: 'with-barcode', label: 'Con código de barras', group: 'Producto', icon: 'barcode' },
  { id: 'type:weight', label: 'Por peso', group: 'Tipo', icon: 'weight' },
  { id: 'type:volume', label: 'Por volumen', group: 'Tipo', icon: 'cup-water' },
  { id: 'type:count', label: 'Por unidad', group: 'Tipo', icon: 'counter' },
  { id: 'stock:positive', label: 'Con stock', group: 'Stock', icon: 'package-variant-closed-check' },
  { id: 'stock:zero', label: 'Stock en cero', group: 'Stock', icon: 'package-variant-closed' },
  { id: 'stock:negative', label: 'Stock negativo', group: 'Stock', icon: 'package-variant-closed-minus' },
  { id: 'price:configured', label: 'Con precio', group: 'Precio', icon: 'cash-check' },
  { id: 'price:missing', label: 'Sin precio', group: 'Precio', icon: 'cash-remove' },
];

function imageUrlForDevice(url: string) {
  if (Platform.OS !== 'android') return url;
  return url.replace(/https?:\/\/(localhost|127\.0\.0\.1)/, 'http://10.0.2.2');
}

function formatNumber(value: string | number, maximumFractionDigits = 3) {
  return new Intl.NumberFormat('es-PE', { maximumFractionDigits }).format(Number(value) || 0);
}

function ProductCard({
  adding,
  disabled,
  orderQuantity,
  onPress,
  product,
}: {
  adding: boolean;
  disabled: boolean;
  orderQuantity: number;
  onPress: () => void;
  product: PosCatalogProduct;
}) {
  const price = catalogPriceSummary(product);
  const stockUnit = product.base_unit?.code ?? product.base_unit?.name ?? 'unidades';
  const priceRecentlyChanged = Boolean(
    product.price_highlight_until
    && new Date(product.price_highlight_until).getTime() > Date.now(),
  );

  return (
    <Pressable
      accessibilityLabel={`Agregar ${product.name} a la orden`}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.productCard,
        priceRecentlyChanged && styles.productCardPriceChanged,
        pressed && styles.productCardPressed,
        adding && styles.productCardAdding,
      ]}
    >
      <View style={styles.imageFrame}>
        {product.image_url ? (
          <Image
            accessibilityLabel={`Imagen de ${product.name}`}
            resizeMode="cover"
            source={{ uri: imageUrlForDevice(product.image_url) }}
            style={styles.productImage}
          />
        ) : (
          <Icon color="#60706E" size={42} source="image-outline" />
        )}
        {product.is_favorite ? (
          <View pointerEvents="none" style={styles.favoriteBadge}>
            <Icon color="#FFFFFF" size={17} source="star" />
          </View>
        ) : null}
        {orderQuantity > 0 ? (
          <View pointerEvents="none" style={styles.orderQuantityBadge}>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.65}
              numberOfLines={1}
              style={styles.orderQuantityText}
            >
              {formatNumber(orderQuantity)}
            </Text>
          </View>
        ) : null}
        {priceRecentlyChanged ? (
          <View pointerEvents="none" style={styles.priceChangedBadge}>
            <Icon color="#7A4300" size={14} source="tag-outline" />
            <Text style={styles.priceChangedBadgeText}>PRECIO NUEVO</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardBody}>
        <Text numberOfLines={2} style={styles.productName}>{product.name}</Text>
        <Text numberOfLines={1} style={styles.productSku}>{product.sku}</Text>
        <View style={styles.stockRow}>
          <Icon color="#337B67" size={15} source="package-variant-closed" />
          <Text numberOfLines={1} style={styles.stockText}>
            Stock: {formatNumber(product.stock_available)} {stockUnit}
          </Text>
        </View>
        <Text numberOfLines={1} style={[styles.price, !price && styles.missingPrice]}>
          {price
            ? `S/ ${price.amount.toFixed(2)}${price.unit ? ` / ${price.unit}` : ''}`
            : 'Precio no configurado'}
        </Text>
        {price?.lowerAmount !== null && price?.lowerFrom ? (
          <Text numberOfLines={1} style={styles.lowerPrice}>
            Desde S/ {price.lowerAmount.toFixed(2)} · {price.lowerFrom}+
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function CatalogHeading() {
  return (
    <View style={styles.catalogHeading}>
      <Text style={styles.sectionTitle}>Todos los productos</Text>
    </View>
  );
}

type PosProductCatalogProps = {
  activeFilterIds: string[];
  activeOrderQuantities: Record<number, number>;
  addingProductId: number | null;
  cashSessionId: string;
  orderBusy: boolean;
  onAddProduct: (product: PosCatalogProduct) => void;
  onSearchExpandedChange: (expanded: boolean) => void;
  onQueryChange: (query: string) => void;
  onToggleFilter: (filterId: string) => void;
  query: string;
  searchExpanded: boolean;
};

type PosCatalogPage = {
  items: PosCatalogProduct[];
  next_cursor: string | null;
  has_more: boolean;
};

export function PosProductCatalog({
  activeFilterIds,
  activeOrderQuantities,
  addingProductId,
  cashSessionId,
  orderBusy,
  onAddProduct,
  onSearchExpandedChange,
  onQueryChange,
  onToggleFilter,
  query,
  searchExpanded,
}: PosProductCatalogProps) {
  const { catalogVersion } = usePriceNotifications();
  const { width } = useWindowDimensions();
  const [catalogWidth, setCatalogWidth] = useState(width);
  const [products, setProducts] = useState<PosCatalogProduct[]>([]);
  const [debouncedQuery, setDebouncedQuery] = useState(query.trim());
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [loadMoreError, setLoadMoreError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const loadMoreController = useRef<AbortController | null>(null);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    loadMoreController.current?.abort();
    loadingMoreRef.current = false;
    setLoading(true);
    setLoadingMore(false);
    setError('');
    setLoadMoreError('');
    setProducts([]);
    setNextCursor(null);
    setHasMore(false);

    async function loadFirstPage() {
      try {
        const response = await api.get(`/cash-register-sessions/${cashSessionId}/catalog`, {
          params: {
            per_page: CATALOG_PAGE_SIZE,
            search: debouncedQuery || undefined,
            filters: activeFilterIds.length > 0 ? activeFilterIds : undefined,
          },
          signal: controller.signal,
        });
        const page = response.data.data as PosCatalogPage;

        if (controller.signal.aborted) return;
        setProducts(page.items ?? []);
        setNextCursor(page.next_cursor ?? null);
        setHasMore(Boolean(page.has_more));
      } catch (requestError: any) {
        if (controller.signal.aborted) return;
        setError(requestError?.response?.data?.message ?? 'No se pudo cargar el catálogo del POS.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadFirstPage();

    return () => {
      controller.abort();
      loadMoreController.current?.abort();
    };
  }, [activeFilterIds, cashSessionId, catalogVersion, debouncedQuery, reloadKey]);

  const loadMoreProducts = useCallback(async () => {
    if (loading || loadingMoreRef.current || !hasMore || !nextCursor) return;

    const controller = new AbortController();
    loadMoreController.current = controller;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreError('');

    try {
      const response = await api.get(`/cash-register-sessions/${cashSessionId}/catalog`, {
        params: {
          cursor: nextCursor,
          per_page: CATALOG_PAGE_SIZE,
          search: debouncedQuery || undefined,
          filters: activeFilterIds.length > 0 ? activeFilterIds : undefined,
        },
        signal: controller.signal,
      });
      const page = response.data.data as PosCatalogPage;

      if (controller.signal.aborted) return;
      setProducts((current) => {
        const currentIds = new Set(current.map((product) => product.id));
        return [...current, ...(page.items ?? []).filter((product) => !currentIds.has(product.id))];
      });
      setNextCursor(page.next_cursor ?? null);
      setHasMore(Boolean(page.has_more));
    } catch (requestError: any) {
      if (controller.signal.aborted) return;
      setLoadMoreError(requestError?.response?.data?.message ?? 'No se pudieron cargar más productos.');
    } finally {
      if (loadMoreController.current === controller) loadMoreController.current = null;
      loadingMoreRef.current = false;
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  }, [activeFilterIds, cashSessionId, debouncedQuery, hasMore, loading, nextCursor]);

  const filtered = Boolean(debouncedQuery) || activeFilterIds.length > 0;

  const availableWidth = catalogWidth;
  const columns = availableWidth >= 1050 ? 4 : availableWidth >= 700 ? 3 : 2;
  const rowWidth = Math.max(0, availableWidth - 24);
  const cardWidth = Math.floor((rowWidth - (columns - 1) * 8) / columns);

  const handleCatalogLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);

    if (nextWidth > 0) {
      setCatalogWidth((current) => current === nextWidth ? current : nextWidth);
    }
  }, []);

  return (
    <View onLayout={handleCatalogLayout} style={styles.catalog}>
      {searchExpanded ? (
        <View style={styles.searchArea}>
          <View style={styles.searchComponent}>
            <ListSearch
              activeFilterIds={activeFilterIds}
              collapsible
              expanded={searchExpanded}
              filterIcon="filter-variant"
              filterOptions={FILTER_OPTIONS}
              filtersTitle="Filtros"
              onExpandedChange={onSearchExpandedChange}
              onQueryChange={onQueryChange}
              onToggleFilter={onToggleFilter}
              placeholder="Nombre, SKU o código de barras"
              query={query}
              searchAccessibilityLabel="Buscar productos del POS"
            />
          </View>
        </View>
      ) : null}

      <FlatList
        columnWrapperStyle={styles.productRow}
        contentContainerStyle={styles.productList}
        data={products}
        extraData={activeOrderQuantities}
        initialNumToRender={columns * 3}
        key={columns}
        keyExtractor={(product) => String(product.id)}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={loading ? (
          <View style={styles.emptyCatalog}>
            <ActivityIndicator color="#B4232D" size="large" />
            <Text style={styles.stateTitle}>Cargando productos</Text>
            <Text style={styles.stateText}>Consultando un bloque del catálogo de esta caja.</Text>
          </View>
        ) : error ? (
          <View style={styles.emptyCatalog}>
            <Icon color="#8F1D2C" size={42} source="alert-circle-outline" />
            <Text style={styles.stateTitle}>No se pudo abrir el catálogo</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Button icon="reload" mode="outlined" onPress={() => setReloadKey((current) => current + 1)}>
              Reintentar
            </Button>
          </View>
        ) : (
          <View style={styles.emptyCatalog}>
            <Icon color="#60706E" size={44} source={filtered ? 'filter-variant' : 'package-variant'} />
            <Text style={styles.stateTitle}>{filtered ? 'Sin coincidencias' : 'Catálogo vacío'}</Text>
            <Text style={styles.stateText}>
              {filtered
                ? 'Prueba con otro texto o cambia los filtros seleccionados.'
                : 'No hay productos activos vinculados con los almacenes de esta tienda.'}
            </Text>
          </View>
        )}
        ListFooterComponent={loadingMore ? (
          <ActivityIndicator color="#B4232D" style={styles.loadMore} />
        ) : loadMoreError ? (
          <View style={styles.loadMoreError}>
            <Text style={styles.errorText}>{loadMoreError}</Text>
            <Button compact icon="reload" mode="text" onPress={() => void loadMoreProducts()}>
              Reintentar
            </Button>
          </View>
        ) : null}
        ListHeaderComponent={<CatalogHeading />}
        maxToRenderPerBatch={columns * 2}
        numColumns={columns}
        onEndReached={() => void loadMoreProducts()}
        onEndReachedThreshold={0.6}
        removeClippedSubviews={Platform.OS !== 'web'}
        renderItem={({ item }) => (
          <View style={{ width: cardWidth }}>
            <ProductCard
              adding={addingProductId === item.id}
              disabled={orderBusy}
              onPress={() => onAddProduct(item)}
              orderQuantity={activeOrderQuantities[item.id] ?? 0}
              product={item}
            />
          </View>
        )}
        showsVerticalScrollIndicator={false}
        updateCellsBatchingPeriod={40}
        windowSize={5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  catalog: { flex: 1, backgroundColor: '#F3F6F5' },
  searchArea: { paddingHorizontal: 12, paddingBottom: 8, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#D7E0DE' },
  searchComponent: { maxWidth: 760, width: '100%', alignSelf: 'center' },
  productList: { width: '100%', alignSelf: 'center', paddingHorizontal: 12, paddingBottom: 20 },
  sectionTitle: { color: '#172423', fontSize: 15, fontWeight: '900' },
  catalogHeading: { paddingTop: 12, paddingBottom: 8 },
  productRow: { width: '100%', gap: 8, marginBottom: 8 },
  productCard: { overflow: 'hidden', borderWidth: 1, borderColor: '#DFE5E7', borderRadius: 10, backgroundColor: '#FFFFFF' },
  productCardPriceChanged: { borderWidth: 2, borderColor: '#E7A83D', backgroundColor: '#FFF9EC' },
  productCardPressed: { borderColor: '#75A9B7', transform: [{ scale: 0.985 }] },
  productCardAdding: { opacity: 0.72 },
  imageFrame: { position: 'relative', width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAEFEE' },
  productImage: { width: '100%', height: '100%' },
  favoriteBadge: { position: 'absolute', top: 7, left: 7, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 15, backgroundColor: '#FF4D4D' },
  orderQuantityBadge: { position: 'absolute', top: 7, right: 7, width: 31, height: 31, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 16, backgroundColor: '#B4232D' },
  orderQuantityText: { width: '100%', color: '#FFFFFF', fontSize: 10, fontWeight: '900', textAlign: 'center' },
  priceChangedBadge: { position: 'absolute', left: 7, right: 7, bottom: 7, minHeight: 27, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 8, backgroundColor: '#FFE1A8' },
  priceChangedBadgeText: { color: '#7A4300', fontSize: 9, fontWeight: '900' },
  cardBody: { padding: 8 },
  productName: { minHeight: 35, color: '#172423', fontSize: 13, lineHeight: 17, fontWeight: '900' },
  productSku: { marginTop: 2, color: '#60706E', fontSize: 9, fontWeight: '700' },
  stockRow: { minWidth: 0, marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  stockText: { flex: 1, color: '#337B67', fontSize: 10, fontWeight: '800' },
  price: { marginTop: 5, color: '#B4232D', fontSize: 11, fontWeight: '900' },
  lowerPrice: { marginTop: 2, color: '#60706E', fontSize: 8, fontWeight: '700' },
  missingPrice: { color: '#8F1D2C', fontSize: 9 },
  stateTitle: { color: '#4D565A', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  stateText: { maxWidth: 360, color: '#60706E', fontSize: 11, lineHeight: 17, textAlign: 'center' },
  errorText: { maxWidth: 380, color: '#8F1D2C', fontSize: 11, lineHeight: 17, textAlign: 'center' },
  emptyCatalog: { minHeight: 220, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 9 },
  loadMore: { paddingVertical: 18 },
  loadMoreError: { paddingVertical: 12, alignItems: 'center', gap: 2 },
});
