import { useLocalSearchParams } from 'expo-router';
import { PurchaseOrderForm } from '../../features/purchases/purchase-order-form';

export default function EditPurchaseScreen() {
  const { purchaseId } = useLocalSearchParams<{ purchaseId: string }>();
  return <PurchaseOrderForm purchaseId={purchaseId} />;
}
