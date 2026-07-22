import { useLocalSearchParams } from 'expo-router';
import { ModuleLayout } from '../../components/module/module-layout';
import { getVisibleMenu } from '../../config/menu';
import { InventoryMovementList } from '../../features/inventory/inventory-movement-list';
import type { InventoryMovementFlow } from '../../features/inventory/inventory-types';

const INVENTORY_MODULE = getVisibleMenu().find((module) => module.id === 'inventory');

export default function InventoryMovementsScreen() {
  const { productId, flow } = useLocalSearchParams<{ productId?: string; flow?: string }>();
  if (!INVENTORY_MODULE) return null;

  const initialFlow: InventoryMovementFlow = flow === 'in' || flow === 'out' ? flow : 'all';

  return (
    <ModuleLayout module={INVENTORY_MODULE} selectedItemId="movements">
      <InventoryMovementList initialFlow={initialFlow} productId={productId} showBack />
    </ModuleLayout>
  );
}
