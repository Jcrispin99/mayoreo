import { Image, Platform, Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { DataTable, type DataTableColumn } from '../../components/data/data-table';
import type { ProductListItem } from './product-list';

type ProductDataTableProps = {
  products: ProductListItem[];
  loading: boolean;
  refreshing: boolean;
  error: string;
  filtered: boolean;
  onRefresh: () => void;
  onRetry: () => void;
  onProductPress: (product: ProductListItem) => void;
  onFavoritePress: (product: ProductListItem) => void;
};

function imageUrlForDevice(url: string) {
  if (Platform.OS !== 'android') return url;
  return url.replace(/https?:\/\/(localhost|127\.0\.0\.1)/, 'http://10.0.2.2');
}

function formatQuantity(quantity: number) {
  return new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 }).format(quantity);
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

function ProductImageCell({ product }: { product: ProductListItem }) {
  return (
    <View style={styles.thumbnail}>
      {product.image_url ? (
        <Image
          accessibilityLabel={`Imagen de ${product.name}`}
          resizeMode="cover"
          source={{ uri: imageUrlForDevice(product.image_url) }}
          style={styles.image}
        />
      ) : (
        <Icon source="image-outline" color="#A39CA6" size={30} />
      )}
    </View>
  );
}

function ProductDetailCell({ product }: { product: ProductListItem }) {
  const unit = product.base_unit?.code ?? product.base_unit?.name ?? 'unidades';

  return (
    <View>
      <Text numberOfLines={2} style={styles.name}>{product.name}</Text>
      <Text numberOfLines={1} style={styles.reference}>
        {product.sku}{product.barcode ? ` · ${product.barcode}` : ''}
      </Text>
      <Text style={styles.detail}>
        Precio: {product.price === null ? 'Sin configurar' : `S/ ${formatMoney(product.price)}${product.priceUnit ? ` por ${product.priceUnit}` : ''}`}
      </Text>
      <Text style={styles.detail}>A la mano: {formatQuantity(product.quantity)} {unit}</Text>
    </View>
  );
}

function ProductFavoriteCell({
  product,
  onPress,
}: {
  product: ProductListItem;
  onPress: () => void;
}) {
  function toggleFavorite(event: GestureResponderEvent) {
    event.stopPropagation();
    onPress();
  }

  return (
    <Pressable
      accessibilityLabel={product.is_favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      accessibilityRole="button"
      hitSlop={8}
      onPress={toggleFavorite}
      style={({ pressed }) => [styles.favoriteButton, pressed && styles.favoriteButtonPressed]}
    >
      <Icon
        source={product.is_favorite ? 'star' : 'star-outline'}
        color={product.is_favorite ? '#D18A25' : '#817986'}
        size={25}
      />
    </Pressable>
  );
}

export function ProductDataTable({
  products,
  loading,
  refreshing,
  error,
  filtered,
  onRefresh,
  onRetry,
  onProductPress,
  onFavoritePress,
}: ProductDataTableProps) {
  const columns: DataTableColumn<ProductListItem>[] = [
    {
      key: 'image',
      title: 'Imagen',
      style: styles.imageColumn,
      headerAlign: 'center',
      renderCell: (product) => <ProductImageCell product={product} />,
    },
    {
      key: 'detail',
      title: 'Detalle',
      style: styles.detailColumn,
      renderCell: (product) => <ProductDetailCell product={product} />,
    },
    {
      key: 'favorite',
      title: 'Favorito',
      style: styles.favoriteColumn,
      headerAlign: 'center',
      renderCell: (product) => (
        <ProductFavoriteCell product={product} onPress={() => onFavoritePress(product)} />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={products}
      emptyIcon="package-variant"
      emptyText={filtered ? 'Prueba con otro texto o cambia los filtros.' : 'Usa “Nuevo” para crear el primer producto.'}
      emptyTitle={filtered ? 'Sin resultados' : 'Aún no hay productos'}
      error={error}
      keyExtractor={(product) => String(product.id)}
      loading={loading}
      onRefresh={onRefresh}
      onRetry={onRetry}
      onRowPress={onProductPress}
      refreshing={refreshing}
      rowAccessibilityLabel={(product) => `Editar ${product.name}`}
      showHeader={false}
    />
  );
}

const styles = StyleSheet.create({
  imageColumn: { width: 78, alignItems: 'center' },
  detailColumn: { flex: 1, paddingHorizontal: 8 },
  favoriteColumn: { width: 66, alignItems: 'center' },
  thumbnail: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#F4F1F5',
  },
  image: { width: '100%', height: '100%' },
  name: { color: '#24202A', fontSize: 14, lineHeight: 18, fontWeight: '800' },
  reference: { marginTop: 2, color: '#6A626F', fontSize: 10, fontWeight: '700' },
  detail: { marginTop: 4, color: '#4F4755', fontSize: 12 },
  favoriteButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  favoriteButtonPressed: { backgroundColor: '#F2EAF4' },
});
