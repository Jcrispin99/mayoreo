import { Redirect, useLocalSearchParams } from 'expo-router';
import { CashSessionOpenForm } from '../../../features/pos/cash-session-open-form';

export default function OpenCashSessionScreen() {
  const { cashRegisterId } = useLocalSearchParams<{ cashRegisterId?: string | string[] }>();
  const id = Array.isArray(cashRegisterId) ? cashRegisterId[0] : cashRegisterId;

  if (!id) return <Redirect href="/home" />;
  return <CashSessionOpenForm cashRegisterId={id} />;
}
