import { useLocalSearchParams } from 'expo-router';
import { ProductVariantList } from '../../features/products/product-variant-list';

export default function ProductVariantsScreen() {
  const { templateId } = useLocalSearchParams<{ templateId: string }>();
  return <ProductVariantList templateId={templateId} />;
}
