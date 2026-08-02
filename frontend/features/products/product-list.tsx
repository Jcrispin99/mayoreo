import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { ListToolbar } from '../../components/data/list-toolbar';
import { api, apiErrorMessage } from '../../lib/api';
import { ProductDataTable } from './product-data-table';

type PriceTierSummary = {
  min_quantity: string | number;
  unit_price: string | number;
  is_active: boolean;
};

export type ProductVariantSummary = {
  id: number;
  product_template_id: number | null;
  sku: string;
  barcode: string | null;
  name: string;
  display_name?: string;
  variant_name: string | null;
  image_url: string | null;
  is_active: boolean;
  is_favorite: boolean;
  sale_mode: 'unit' | 'measured';
  base_unit?: { id: number; code: string; name: string } | null;
  content_quantity?: string | number | null;
  content_unit?: { id: number; code: string; name: string } | null;
  price_tiers?: PriceTierSummary[];
};

export type ProductSummary = {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  variants: ProductVariantSummary[];
};

export type ProductVariantListItem = ProductVariantSummary & {
  quantity: number;
  price: number | null;
  priceUnit: string | null;
};

export type ProductListItem = Omit<ProductSummary, 'variants'> & {
  is_favorite: boolean;
  variants: ProductVariantListItem[];
  minimumPrice: number | null;
  maximumPrice: number | null;
};

type StockRecord = {
  product_id: number;
  quantity: string | number;
};

type ProductListProps = {
  onCreate: () => void;
  onEdit: (product: ProductSummary) => void;
};

const PAGE_SIZE = 20;
const PRODUCT_FILTERS = [
  { id: 'favorite', label: 'Favoritos', group: 'Producto', icon: 'star' },
  { id: 'active', label: 'Activos', group: 'Estado' },
  { id: 'inactive', label: 'Inactivos', group: 'Estado' },
];

function combineProductsAndStock(templates: ProductSummary[], stocks: StockRecord[]): ProductListItem[] {
  const quantities = new Map<number, number>();

  stocks.forEach((stock) => {
    const currentQuantity = quantities.get(stock.product_id) ?? 0;
    quantities.set(stock.product_id, currentQuantity + (Number(stock.quantity) || 0));
  });

  return templates.map((template) => {
    const variants = (template.variants ?? []).filter((variant) => variant.is_active).map((variant) => {
      const basePriceTier = variant.price_tiers
        ?.filter((tier) => tier.is_active)
        .sort((first, second) => Number(first.min_quantity) - Number(second.min_quantity))[0];
      const baseUnitCode = variant.base_unit?.code.trim().toLocaleLowerCase('es') ?? '';
      const factor = baseUnitCode === 'g' || baseUnitCode === 'gr' || baseUnitCode === 'ml' ? 1000 : 1;
      const unit = variant.sale_mode === 'unit'
        ? 'un.'
        : baseUnitCode === 'g' || baseUnitCode === 'gr'
        ? 'kg'
        : baseUnitCode === 'ml' ? 'L' : variant.base_unit?.code ?? null;

      return {
        ...variant,
        quantity: quantities.get(variant.id) ?? 0,
        price: basePriceTier ? Number(basePriceTier.unit_price) * factor : null,
        priceUnit: unit,
      };
    });
    const prices = variants.map((variant) => variant.price).filter((price): price is number => price !== null);

    return {
      ...template,
      variants,
      is_favorite: variants.some((variant) => variant.is_favorite),
      minimumPrice: prices.length > 0 ? Math.min(...prices) : null,
      maximumPrice: prices.length > 0 ? Math.max(...prices) : null,
    };
  });
}

export function ProductList({ onCreate, onEdit }: ProductListProps) {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [activeFilterIds, setActiveFilterIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [favoriteError, setFavoriteError] = useState('');

  const loadProducts = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');

    try {
      const [productsResponse, stocksResponse] = await Promise.all([
        api.get('/product-templates'),
        api.get('/stocks'),
      ]);
      setProducts(combineProductsAndStock(productsResponse.data.data ?? [], stocksResponse.data.data ?? []));
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'No se pudieron cargar los productos.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es');
    const selectedStates = activeFilterIds.filter((filterId) => filterId === 'active' || filterId === 'inactive');

    return products.filter((product) => {
      const variantSearch = product.variants
        .map((variant) => `${variant.variant_name ?? ''} ${variant.sku} ${variant.barcode ?? ''}`)
        .join(' ');
      const matchesQuery = !normalizedQuery
        || `${product.name} ${variantSearch}`.toLocaleLowerCase('es').includes(normalizedQuery);
      const matchesFavorite = !activeFilterIds.includes('favorite') || product.is_favorite;
      const matchesState = selectedStates.length === 0
        || (product.is_active ? selectedStates.includes('active') : selectedStates.includes('inactive'));
      return matchesQuery && matchesFavorite && matchesState;
    });
  }, [activeFilterIds, products, query]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleProducts = useMemo(
    () => filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, filteredProducts],
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function changeQuery(nextQuery: string) {
    setQuery(nextQuery);
    setPage(1);
  }

  function toggleFilter(filterId: string) {
    setActiveFilterIds((current) => current.includes(filterId)
      ? current.filter((currentId) => currentId !== filterId)
      : [...current, filterId]);
    setPage(1);
  }

  async function toggleFavorite(product: ProductListItem) {
    const nextValue = !product.is_favorite;
    const principal = product.variants.find((variant) => variant.is_favorite)
      ?? product.variants[0];
    if (!principal) return;
    setProducts((current) =>
      current.map((item) => (item.id === product.id
        ? {
          ...item,
          is_favorite: nextValue,
          variants: item.variants.map((variant) => (
            variant.id === principal.id ? { ...variant, is_favorite: nextValue } : variant
          )),
        }
        : item)),
    );

    try {
      await api.patch(`/products/${principal.id}`, { is_favorite: nextValue });
    } catch {
      setProducts((current) =>
        current.map((item) => (item.id === product.id ? { ...item, is_favorite: product.is_favorite } : item)),
      );
      setFavoriteError('No se pudo actualizar el favorito.');
    }
  }

  return (
    <View style={styles.screen}>
      <ListToolbar
        activeFilterIds={activeFilterIds}
        filterOptions={PRODUCT_FILTERS}
        onCreate={onCreate}
        onPageChange={setPage}
        onQueryChange={changeQuery}
        onToggleFilter={toggleFilter}
        page={currentPage}
        pageSize={PAGE_SIZE}
        query={query}
        title="Productos"
        totalItems={filteredProducts.length}
      />
      <ProductDataTable
        error={error}
        filtered={Boolean(query.trim()) || activeFilterIds.length > 0}
        loading={loading}
        onRefresh={() => void loadProducts(true)}
        onRetry={() => void loadProducts()}
        onProductPress={onEdit}
        onFavoritePress={(product) => void toggleFavorite(product)}
        products={visibleProducts}
        refreshing={refreshing}
      />
      <Snackbar duration={2200} onDismiss={() => setFavoriteError('')} visible={Boolean(favoriteError)}>
        {favoriteError}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' },
});
