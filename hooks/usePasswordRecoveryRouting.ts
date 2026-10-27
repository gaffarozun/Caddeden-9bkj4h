import { useEffect } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { useAuth } from './useAuth';

// Recovering an account never navigates into its customer/business panel.
export function usePasswordRecoveryRouting() {
  const { passwordRecovery } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (passwordRecovery && pathname !== '/password-reset') router.replace('/password-reset');
  }, [passwordRecovery, pathname, router]);
}
