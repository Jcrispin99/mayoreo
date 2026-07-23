import { Redirect, useLocalSearchParams } from 'expo-router';
import { CashRegisterForm } from '../../../features/pos/cash-register-form';

export default function EditCashRegisterScreen() {
  const { cashRegisterId } = useLocalSearchParams<{ cashRegisterId: string | string[] }>();
  const id = Array.isArray(cashRegisterId) ? cashRegisterId[0] : cashRegisterId;

  if (!id) return <Redirect href="/home" />;
  return <CashRegisterForm cashRegisterId={id} />;
}
