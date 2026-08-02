import { useLocalSearchParams } from 'expo-router';
import { AccountingSaleForm } from '../../../features/accounting/accounting-sale-form';

export default function AccountingSaleDetailScreen() {
  const { saleId } = useLocalSearchParams<{ saleId: string }>();
  return <AccountingSaleForm saleId={saleId} />;
}
