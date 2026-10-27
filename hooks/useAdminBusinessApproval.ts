import { useCallback, useRef, useState } from 'react';
import { useAlert } from '@/template';
import { adminApi } from '@/services/adminService';
import { BusinessApprovalStatus } from '@/services/businessApprovalService';

export function useAdminBusinessApproval(onChanged: () => void) {
  const { showAlert } = useAlert();
  const [busy, setBusy] = useState('');
  const inFlight = useRef(false);
  const decide = useCallback((userId: string, name: string, status: BusinessApprovalStatus) => {
    if (inFlight.current) return;
    const approve = status === 'approved';
    showAlert(approve ? 'İşletme girişini onayla' : 'Giriş onayını geri al',
      approve ? `${name} hesabının işletme paneline erişimi açılsın mı? İşletme profili yayın onayı ayrı olarak korunur.` : `${name} hesabı yeniden onay bekleme ekranına alınsın mı? İşletmeler ve mevcut veriler silinmez.`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: approve ? 'Onayla' : 'Onayı geri al', onPress: async () => {
        if (inFlight.current) return;
        inFlight.current = true;
        setBusy(userId);
        try {
          const { error } = await adminApi.setBusinessAccountApproval(userId, status);
          if (error) showAlert('Giriş onayı kaydedilemedi', error);
          else onChanged();
        } catch (reason) {
          showAlert('İşlem tamamlanamadı', reason instanceof Error ? reason.message : 'Tekrar deneyin.');
        } finally { inFlight.current = false; setBusy(''); }
      } },
    ]);
  }, [onChanged, showAlert]);
  return { busy, decide };
}
