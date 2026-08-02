import { useLocalSearchParams } from 'expo-router';
import { CustomerForm } from '../../features/customers/customer-form';

export default function EditCustomerScreen() {
  const { customerId } = useLocalSearchParams<{ customerId: string }>();

  return <CustomerForm customerId={customerId} />;
}
