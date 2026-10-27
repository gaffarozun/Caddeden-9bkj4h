import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { BusinessApprovalView } from '@/components/feature/BusinessApprovalView';

export default function BusinessApprovalScreen() {
  const { authUser, loading, operationLoading, profileError } = useAuth();
  if (!loading && !operationLoading && !profileError) {
    if (!authUser) return <Redirect href="/auth" />;
    if (authUser.role !== 'business' || authUser.businessAccess) return <Redirect href="/" />;
  }
  return <BusinessApprovalView />;
}
