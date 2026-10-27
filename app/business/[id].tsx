import { useLocalSearchParams } from 'expo-router';
import { BusinessProfileView } from '@/components/feature/BusinessProfileView';
export default function BusinessDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BusinessProfileView businessId={typeof id === 'string' ? id : ''} />;
}
