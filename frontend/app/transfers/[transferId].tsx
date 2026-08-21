import { useLocalSearchParams } from 'expo-router';
import { InventoryTransferForm } from '../../features/inventory/inventory-transfer-form';

export default function InventoryTransferDetailScreen() {
  const { transferId } = useLocalSearchParams<{ transferId: string }>();

  return <InventoryTransferForm transferId={transferId} />;
}