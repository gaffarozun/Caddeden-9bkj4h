export interface PaymentContent { payment_status?: string; created_at: string }
export type PaymentFilter = 'all' | 'paid' | 'unpaid';
export type PaymentOrder = 'newest' | 'paid_first' | 'unpaid_first';
export const paymentFilters = [{ id: 'all', label: 'Tüm ödemeler' }, { id: 'paid', label: 'Ödenenler' }, { id: 'unpaid', label: 'Ödenmeyenler' }];
export const paymentOrders = [{ id: 'newest', label: 'En yeni' }, { id: 'paid_first', label: 'Ödenenler önce' }, { id: 'unpaid_first', label: 'Ödenmeyenler önce' }];
export function arrangeAdminContent<T extends PaymentContent>(rows: T[], filter: PaymentFilter, order: PaymentOrder): T[] {
 return rows.filter(row => filter === 'all' || (filter === 'paid' ? row.payment_status === 'paid' : row.payment_status !== 'paid')).sort((a,b) => {
  const paidDifference = Number(b.payment_status === 'paid') - Number(a.payment_status === 'paid');
  if (order !== 'newest' && paidDifference) return order === 'paid_first' ? paidDifference : -paidDifference;
  return b.created_at.localeCompare(a.created_at);
 });
}
