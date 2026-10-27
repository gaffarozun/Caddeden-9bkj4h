import { useAuth } from './useAuth';
import { canShowAdminEntry } from '@/services/adminEntryService';

export function useAdminEntry(businessPage: boolean) {
  const { authUser, loading, operationLoading, passwordRecovery, profileError } = useAuth();
  return !loading && !operationLoading && !passwordRecovery && !profileError
    && canShowAdminEntry(authUser, businessPage);
}
