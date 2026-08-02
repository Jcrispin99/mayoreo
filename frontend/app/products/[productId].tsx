import { useLocalSearchParams } from 'expo-router';
import { ProductTemplateForm } from '../../features/products/product-template-form';

export default function EditProductScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  return <ProductTemplateForm templateId={productId} />;
}
