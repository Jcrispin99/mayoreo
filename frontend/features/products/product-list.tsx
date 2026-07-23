import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { ListToolbar } from '../../components/data/list-toolbar';
import { api } from '../../lib/api';
import { ProductDataTable } from './product-data-table';

type PriceTierSummary = {
  min_quantity: string | number;
  unit_price: string | number;
  is_active: boolean;
};

export type ProductSummary = {
  id: number;
  sku: string;
  barcode: string | null;
  name: string;
  image_url: string | null;
  is_active: boolean;
  is_favorite: boolean;
  base_unit?: { id: number; code: string; name: string } | null;
  price_tiers?: PriceTierSummary[];
};

export type ProductListItem = ProductSummary & {
  quantity: number;
  price: number | null;
  priceUnit: string | null;
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

function combineProductsAndStock(products: ProductSummary[], stocks: StockRecord[]): ProductListItem[] {
  const quantities = new Map<number, number>();

  stocks.forEach((stock) => {
    const currentQuantity = quantities.get(stock.product_id) ?? 0;
    quantities.set(stock.product_id, currentQuantity + (Number(stock.quantity) || 0));
  });

  return products.map((product) => {
    const quantity = quantities.get(product.id) ?? 0;
    const basePriceTier = product.price_tiers
      ?.filter((tier) => tier.is_active)
      .sort((first, second) => Number(first.min_quantity) - Number(second.min_quantity))[0];
    const baseUnitCode = product.base_unit?.code.trim().toLocaleLowerCase('es') ?? '';
    const priceFactor = baseUnitCode === 'g' || baseUnitCode === 'gr' || baseUnitCode === 'ml' ? 1000 : 1;
    const priceUnit = baseUnitCode === 'g' || baseUnitCode === 'gr'
      ? 'kg'
      : baseUnitCode === 'ml' ? 'L' : product.base_unit?.code ?? null;

    return {
      ...product,
      is_favorite: product.is_favorite ?? false,
      quantity,
      price: basePriceTier ? Number(basePriceTier.unit_price) * priceFactor : null,
      priceUnit,
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
        api.get('/products'),
        api.get('/stocks'),
      ]);
      setProducts(combineProductsAndStock(productsResponse.data.data ?? [], stocksResponse.data.data ?? []));
    } catch {
      setError('No se pudieron cargar los productos.');
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
      const matchesQuery = !normalizedQuery
        || `${product.name} ${product.sku} ${product.barcode ?? ''}`.toLocaleLowerCase('es').includes(normalizedQuery);
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
    setProducts((current) =>
      current.map((item) => (item.id === product.id ? { ...item, is_favorite: nextValue } : item)),
    );

    try {
      await api.patch(`/products/${product.id}`, { is_favorite: nextValue });
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
  screen: { flex: 1, backgroundColor: '#F7F5F8' },
});
