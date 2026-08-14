import { useLocalSearchParams } from 'expo-router';
import { PayrollDetail } from '../../../features/workforce/payroll-detail';

export default function PayrollPeriodRoute() {
  const { periodId } = useLocalSearchParams<{ periodId: string }>();
  return <PayrollDetail periodId={String(periodId)} />;
}
