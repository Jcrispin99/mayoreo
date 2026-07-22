import { useLocalSearchParams } from 'expo-router';
import { SupplierForm } from '../../../features/purchases/supplier-form';

export default function EditSupplierScreen() {
  const { supplierId } = useLocalSearchParams<{ supplierId: string }>();
  return <SupplierForm supplierId={supplierId} />;
}
