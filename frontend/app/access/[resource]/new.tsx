import { Redirect, useLocalSearchParams } from 'expo-router';
import { AccessReferenceForm } from '../../../features/access/access-reference-form';
import type { AccessResourceKind } from '../../../features/access/access-types';

const RESOURCES: AccessResourceKind[] = ['users', 'roles'];

export default function NewAccessReferenceScreen() {
  const { resource } = useLocalSearchParams<{ resource: string }>();
  if (!RESOURCES.includes(resource as AccessResourceKind)) return <Redirect href="/home" />;

  return <AccessReferenceForm kind={resource as AccessResourceKind} />;
}
