import { useLocalSearchParams } from 'expo-router';
import { ProductForm } from '../../features/products/product-form';

export default function EditProductScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  return <ProductForm productId={productId} />;
}
