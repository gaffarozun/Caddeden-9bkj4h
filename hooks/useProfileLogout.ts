import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useAlert } from '@/template';
import { useAuth } from './useAuth';

export function useProfileLogout() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const { authUser, loading, operationLoading, signOut } = useAuth();
  const busy = loading || operationLoading;
  const confirmLogout = useCallback(() => {
    if (busy || !authUser) return;
    showAlert('Çıkış yap', 'Hesabınızdan çıkmak istiyor musunuz?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış yap', onPress: () => {
        void signOut().then(result => {
          // Failed cleanup retains the account and is reported by AuthProvider.
          if (!result.error) {
            router.dismissAll();
            router.replace('/auth');
          }
        });
      } },
    ]);
  }, [authUser, busy, router, showAlert, signOut]);
  return { busy, confirmLogout };
}
