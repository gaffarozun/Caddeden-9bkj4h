import { useLocalSearchParams } from 'expo-router';
import { BusinessMenuView } from '@/components/feature/BusinessMenuView';
export default function BusinessMenuScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BusinessMenuView businessId={typeof id === 'string' ? id : ''} />;
}
