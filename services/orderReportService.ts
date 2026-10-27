import { getSupabaseClient } from '@/template';
import { adminApi } from './adminService';
import { OrderRow } from './businessRequestService';
import { withRequestTimeout } from './requestTimeoutService';

export type OrderReportPeriod = 'today' | 'week' | 'month' | 'all' | 'custom';
export type OrderReportSort = 'newest' | 'oldest' | 'highest' | 'lowest';
export type OrderReportView = 'orders' | 'daily';
export interface OrderReportFilters {
  start: string | null;
  end: string | null;
  business: string | null;
  status: string;
  sort: OrderReportSort;
  view: OrderReportView;
  page: number;
}
export interface DailyOrderReport {
  day: string;
  order_count: number;
  delivered_count: number;
  revenue: number;
}
export interface OrderReport {
  orders: OrderRow[];
  days: DailyOrderReport[];
  totalRows: number;
  page: number;
  pageSize: number;
  summary: { orderCount: number; deliveredCount: number; revenue: number; average: number };
  businesses: { id: string; name: string }[];
}
export type OrderReportListRow = { kind: 'order'; key: string; order: OrderRow } | { kind: 'day'; key: string; day: DailyOrderReport };

// Istanbul has UTC+03 year-round; no dependency on the device's time zone.
export function istanbulDay(now = new Date()): string {
  return new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export function reportDateRange(period: Exclude<OrderReportPeriod, 'custom'>, now = new Date()) {
  const end = istanbulDay(now);
  if (period === 'all') return { start: null, end: null };
  if (period === 'month') return { start: `${end.slice(0, 7)}-01`, end };
  if (period === 'week') return { start: new Date(Date.parse(`${end}T00:00:00Z`) - 6 * 86400000).toISOString().slice(0, 10), end };
  return { start: end, end };
}
export function validReportDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0, 4) < '1900' || value.slice(0, 4) > '9998') return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function customReportDateError(start: string, end: string): string {
  if (!validReportDay(start) || !validReportDay(end)) return 'Geçerli tarihleri YYYY-AA-GG biçiminde girin. Örnek: 2026-10-23.';
  if (start > end) return 'Başlangıç tarihi bitiş tarihinden sonra olamaz.';
  return '';
}
export function reportDayLabel(day: string): string {
  const [year, month, date] = day.split('-');
  return `${date}.${month}.${year}`;
}
export function reportDateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Tarih bilinmiyor';
  const shifted = new Date(date.getTime() + 3 * 60 * 60 * 1000).toISOString();
  return `${reportDayLabel(shifted.slice(0, 10))} · ${shifted.slice(11, 16)}`;
}
export function orderReportRows(report: OrderReport | null, view: OrderReportView): OrderReportListRow[] {
  if (!report) return [];
  return view === 'orders'
    ? report.orders.map(order => ({ kind: 'order', key: order.id, order }))
    : report.days.map(day => ({ kind: 'day', key: day.day, day }));
}
export async function loadOrderReport(adminMode: boolean, filters: OrderReportFilters): Promise<OrderReport> {
  const params = {
    p_start: filters.start, p_end: filters.end, p_business: filters.business,
    p_status: filters.status, p_sort: filters.sort, p_view: filters.view, p_page: filters.page,
  };
  const timeoutMessage = 'Sipariş raporu yüklenemedi. Bağlantınızı kontrol edip yeniden deneyin.';
  const result = adminMode
    ? await withRequestTimeout(adminApi.orderReport(params), timeoutMessage, 20000)
    : await withRequestTimeout(getSupabaseClient().rpc('business_order_report', params), timeoutMessage, 20000);
  if (result.error) throw new Error(typeof result.error === 'string' ? result.error : result.error.message);
  const data = result.data as OrderReport | null;
  if (!data || !Array.isArray(data.orders) || !Array.isArray(data.days) || !data.summary || !Array.isArray(data.businesses) || data.pageSize !== 30) {
    throw new Error('Sipariş raporu yüklenemedi. Yeniden deneyin.');
  }
  return data;
}
