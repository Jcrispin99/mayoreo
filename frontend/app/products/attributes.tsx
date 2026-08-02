import { useLocalSearchParams } from 'expo-router';
import { ProductAttributesForm } from '../../features/products/product-attributes-form';

export default function ProductAttributesScreen() {
  const { templateId } = useLocalSearchParams<{ templateId: string }>();
  return <ProductAttributesForm templateId={templateId} />;
}
