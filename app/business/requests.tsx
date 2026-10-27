import { useLocalSearchParams } from 'expo-router';
import { BusinessRequestsView } from '@/components/feature/BusinessRequestsView';
import { AccountRouteBoundary } from '@/components/auth/AccountRouteBoundary';
import { RequestSection } from '@/hooks/useBusinessRequests';
export default function BusinessRequestsScreen() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const initial: RequestSection = section === 'appointments' || section === 'reservations' ? section : 'orders';
  return <AccountRouteBoundary><BusinessRequestsView initialSection={initial} /></AccountRouteBoundary>;
}
