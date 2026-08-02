import { Redirect, useLocalSearchParams } from 'expo-router';
import { DocumentSeriesForm } from '../../../features/pos/document-series-form';

export default function EditDocumentSeriesScreen() {
  const { documentSeriesId } = useLocalSearchParams<{ documentSeriesId: string | string[] }>();
  const id = Array.isArray(documentSeriesId) ? documentSeriesId[0] : documentSeriesId;
  if (!id) return <Redirect href="/home" />;
  return <DocumentSeriesForm documentSeriesId={id} />;
}
