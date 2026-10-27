import { useLocalSearchParams } from 'expo-router';
import { AccountRouteBoundary } from '@/components/auth/AccountRouteBoundary';
import { BusinessReservationView } from '@/components/feature/BusinessReservationView';
export default function BusinessReserveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AccountRouteBoundary><BusinessReservationView businessId={typeof id === 'string' ? id : ''} /></AccountRouteBoundary>;
}
