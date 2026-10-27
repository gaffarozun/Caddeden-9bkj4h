import { adminApi } from './adminService';
import { withRequestTimeout } from './requestTimeoutService';

export type AdminAccountFilter = 'user' | 'business' | 'admin';
export interface AdminUserRow {
  id: string;
  username?: string | null;
  email?: string | null;
  role: string;
  status: string;
  businesses?: { id: string }[];
  business_account_approval?: { status: 'pending' | 'approved'; decided_at: string | null } | null;
  restricted_until?: string | null;
}

export async function loadAdminUsers(): Promise<AdminUserRow[]> {
  const { data, error } = await withRequestTimeout(adminApi.listUsers(), 'Hesap listesi zamanında yüklenemedi. Yeniden deneyin.');
  if (error) throw new Error(error);
  if (!data || !Array.isArray(data.users)) throw new Error('Hesap listesi yanıtı okunamadı.');
  // Classification uses only the stored role, never the presence of a business link.
  return data.users as AdminUserRow[];
}

export async function setAdminUserStatus(userId: string, status: 'active' | 'restricted' | 'banned'): Promise<void> {
  const until = status === 'restricted' ? new Date(Date.now() + 3 * 86400000).toISOString() : null;
  const { error } = await withRequestTimeout(adminApi.restrictUser(userId, status, until), 'Hesap durumu güncellenemedi. Listeyi yenileyin.');
  if (error) throw new Error(error);
}
