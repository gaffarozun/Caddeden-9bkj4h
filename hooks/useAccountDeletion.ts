import { useState } from 'react';
import { getSupabaseClient } from '@/template';
import { useAuth } from './useAuth';
import { useApp } from './useApp';
import { feedbackServer } from '@/services/feedbackService';

export function useAccountDeletion() {
  const { authUser, isAdmin, signOut } = useAuth();
  const { clearLocalAccountData } = useApp();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);
  const submit = async () => {
    if (busy || !authUser || isAdmin) return;
    if (password.length < 6 || confirmation !== 'HESABIMI SİL') { setError('Mevcut şifrenizi girin ve HESABIMI SİL yazın.'); return; }
    setBusy(true); setError('');
    try {
      await feedbackServer('delete_account', { password, confirmation });
      setPassword(''); setConfirmation('');
      try { await clearLocalAccountData(); }
      catch { setError('Hesabınız sunucuda silindi; cihazdaki yerel verilerin temizliği doğrulanamadı.'); }
      // The server invalidated the account. Local sign-out also clears persisted device credentials.
      const { error: logoutError } = await getSupabaseClient().auth.signOut({ scope: 'local' });
      if (logoutError) {
        await signOut();
        setError('Hesabınız sunucuda silindi; cihaz oturumunun temizliği doğrulanamadı.');
      }
      setCompleted(true);
    } catch (reason) { setPassword(''); setError(reason instanceof Error ? reason.message : 'Hesap silinemedi.'); }
    finally { setBusy(false); }
  };
  return { authUser, isAdmin, password, setPassword, confirmation, setConfirmation, busy, error, completed, submit };
}
