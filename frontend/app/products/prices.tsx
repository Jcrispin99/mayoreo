import { useLocalSearchParams } from 'expo-router';
import { ProductSalePrices } from '../../features/products/product-sale-prices';

export default function ProductSalePricesScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  return <ProductSalePrices productId={productId} />;
}
