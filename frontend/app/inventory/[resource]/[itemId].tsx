import { Redirect, useLocalSearchParams } from 'expo-router';
import { InventoryReferenceForm } from '../../../features/inventory/inventory-reference-form';
import type { InventoryResourceKind } from '../../../features/inventory/inventory-types';

const RESOURCES: InventoryResourceKind[] = ['stores', 'warehouses', 'units'];

export default function EditInventoryReferenceScreen() {
  const { resource, itemId } = useLocalSearchParams<{ resource: string; itemId: string }>();
  if (!RESOURCES.includes(resource as InventoryResourceKind)) return <Redirect href="/home" />;

  return <InventoryReferenceForm itemId={itemId} kind={resource as InventoryResourceKind} />;
}
