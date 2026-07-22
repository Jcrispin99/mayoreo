import { Redirect, useLocalSearchParams } from 'expo-router';
import { InventoryReferenceForm } from '../../../features/inventory/inventory-reference-form';
import type { InventoryResourceKind } from '../../../features/inventory/inventory-types';

const RESOURCES: InventoryResourceKind[] = ['stores', 'warehouses', 'units'];

export default function NewInventoryReferenceScreen() {
  const { resource } = useLocalSearchParams<{ resource: string }>();
  if (!RESOURCES.includes(resource as InventoryResourceKind)) return <Redirect href="/home" />;

  return <InventoryReferenceForm kind={resource as InventoryResourceKind} />;
}
