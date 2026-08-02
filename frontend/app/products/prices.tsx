import { useLocalSearchParams } from 'expo-router';
import { ProductSalePrices } from '../../features/products/product-sale-prices';

export default function ProductSalePricesScreen() {
  const { productId, templateId } = useLocalSearchParams<{ productId?: string; templateId?: string }>();
  return <ProductSalePrices productId={productId} templateId={templateId} />;
}
