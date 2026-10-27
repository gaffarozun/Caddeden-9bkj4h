import { getSupabaseClient } from '@/template';

export type BusinessApprovalStatus = 'pending' | 'approved';
export interface BusinessApprovalState {
  status: BusinessApprovalStatus;
  canManage: boolean;
  decidedAt: string | null;
}

export async function loadBusinessApproval(): Promise<BusinessApprovalState> {
  const { data, error } = await getSupabaseClient().rpc('business_account_state');
  if (error) throw new Error(error.message);
  if (!data || !['pending', 'approved'].includes(data.status) || typeof data.canManage !== 'boolean') {
    throw new Error('İşletme hesabının onay durumu doğrulanamadı. Lütfen tekrar deneyin.');
  }
  return {
    status: data.status as BusinessApprovalStatus,
    canManage: data.canManage === true,
    decidedAt: typeof data.decidedAt === 'string' ? data.decidedAt : null,
  };
}
