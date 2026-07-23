import { Redirect, useLocalSearchParams } from 'expo-router';
import { PosTerminalShell } from '../../../features/pos/pos-terminal-shell';

export default function PosTerminalScreen() {
  const { cashSessionId } = useLocalSearchParams<{ cashSessionId: string | string[] }>();
  const id = Array.isArray(cashSessionId) ? cashSessionId[0] : cashSessionId;

  if (!id) return <Redirect href="/home" />;
  return <PosTerminalShell cashSessionId={id} />;
}
