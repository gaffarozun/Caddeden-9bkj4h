import { useLocalSearchParams } from 'expo-router';
import { PasswordRecoveryView } from '@/components/feature/PasswordRecoveryView';

export default function PasswordResetScreen() {
  const params = useLocalSearchParams();
  return <PasswordRecoveryView params={params} />;
}
