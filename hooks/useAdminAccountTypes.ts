import { useCallback, useState } from 'react';
import { useAlert } from '@/template';
import { adminApi } from '@/services/adminService';
export function useAdminAccountTypes(onChanged: () => void) {
 const { showAlert } = useAlert(); const [busy, setBusy] = useState('');
 const decide = useCallback((userId: string, name: string, expected: string, role: 'user' | 'business') => {
  if (busy) return;
  showAlert('Hesap türünü belirle', `${name}: ${role === 'business' ? 'İşletme' : 'Kullanıcı'} hesabı olarak onaylansın mı? Mevcut işletme sahipliği ve işlem kayıtları korunur; diğer hesap türünün işlemleri kapanır. İşletme hesabının giriş erişimi ayrıca onaylanır.`, [
   { text: 'Vazgeç', style: 'cancel' }, { text: 'Onayla', onPress: async () => {
    setBusy(userId);
    try { const result = await adminApi.setAccountType(userId, role, expected); if (result.error) showAlert('Hesap türü kaydedilemedi', result.error); else onChanged(); }
    catch (reason) { showAlert('İşlem tamamlanamadı', reason instanceof Error ? reason.message : 'Tekrar deneyin.'); }
    finally { setBusy(''); }
   } },
  ]);
 }, [busy, onChanged, showAlert]);
 return { busy, decide };
}
