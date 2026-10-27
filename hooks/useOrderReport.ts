import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from './useAuth';
import {
  customReportDateError, istanbulDay, loadOrderReport, orderReportRows, reportDateRange,
  OrderReport, OrderReportFilters, OrderReportPeriod, OrderReportSort, OrderReportView,
} from '@/services/orderReportService';

export function useOrderReport(adminMode = false) {
  const { authUser, loading: authLoading } = useAuth();
  const [period, setPeriod] = useState<OrderReportPeriod>('today');
  const [filters, setFilters] = useState<OrderReportFilters>(() => ({
    ...reportDateRange('today'), business: null, status: 'all', sort: 'newest', view: 'orders', page: 0,
  }));
  const [draftStart, setDraftStart] = useState(() => istanbulDay());
  const [draftEnd, setDraftEnd] = useState(() => istanbulDay());
  const [dateError, setDateError] = useState('');
  const [loaded, setLoaded] = useState<{ key: string; report: OrderReport } | null>(null);
  const [choices, setChoices] = useState<{ owner: string; items: OrderReport['businesses'] } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const generation = useRef(0);
  const ownerKey = `${authUser?.id ?? ''}:${adminMode}`;
  const requestKey = `${ownerKey}:${JSON.stringify(filters)}`;
  const allowed = !authLoading && !!authUser && authUser.status === 'active' && (adminMode ? authUser.role === 'admin' : authUser.role === 'business' && authUser.businessAccess);
  const load = useCallback(async () => {
    const version = ++generation.current;
    setError('');
    if (authLoading) { setLoading(true); return; }
    if (!allowed) {
      setLoaded(null); setChoices(null); setError('Bu rapora erişmek için yetkili hesabınızla giriş yapın.');
      setLoading(false); setRefreshing(false); return;
    }
    try {
      const report = await loadOrderReport(adminMode, filters);
      if (version !== generation.current) return;
      const lastPage = Math.max(0, Math.ceil(report.totalRows / report.pageSize) - 1);
      if (filters.page > lastPage) { setFilters(value => ({ ...value, page: lastPage })); return; }
      setLoaded({ key: requestKey, report });
      setChoices({ owner: ownerKey, items: report.businesses });
    } catch (reason) {
      if (version === generation.current) setError(reason instanceof Error ? reason.message : 'Siparişler yüklenemedi.');
    } finally {
      if (version === generation.current) { setLoading(false); setRefreshing(false); }
    }
  }, [allowed, authLoading, adminMode, filters, requestKey, ownerKey]);
  useFocusEffect(useCallback(() => {
    setLoading(true); void load();
    return () => { generation.current += 1; };
  }, [load]));
  const report = allowed && loaded?.key === requestKey ? loaded.report : null;
  const rows = useMemo(() => orderReportRows(report, filters.view), [report, filters.view]);
  const businesses = choices?.owner === ownerKey && allowed ? choices.items : [];
  const change = useCallback((patch: Partial<OrderReportFilters>) => {
    setFilters(value => ({ ...value, ...patch, page: 0 }));
  }, []);
  const choosePeriod = useCallback((value: OrderReportPeriod) => {
    setPeriod(value); setDateError('');
    if (value === 'custom') {
      setDraftStart(filters.start ?? istanbulDay()); setDraftEnd(filters.end ?? istanbulDay()); return;
    }
    change(reportDateRange(value));
  }, [change, filters.start, filters.end]);
  const updateStart = useCallback((value: string) => { setDraftStart(value); setDateError(''); }, []);
  const updateEnd = useCallback((value: string) => { setDraftEnd(value); setDateError(''); }, []);
  const applyDates = useCallback(() => {
    const message = customReportDateError(draftStart.trim(), draftEnd.trim());
    setDateError(message);
    if (!message) change({ start: draftStart.trim(), end: draftEnd.trim() });
  }, [draftStart, draftEnd, change]);
  const refresh = useCallback(() => {
    setRefreshing(true);
    if (period !== 'custom') {
      const range = reportDateRange(period);
      if (range.start !== filters.start || range.end !== filters.end) { change(range); return; }
    }
    void load();
  }, [period, filters.start, filters.end, change, load]);
  const selectBusiness = useCallback((value: string) => change({ business: value === 'all' ? null : value }), [change]);
  const selectStatus = useCallback((value: string) => change({ status: value }), [change]);
  const selectSort = useCallback((value: string) => change({ sort: value as OrderReportSort }), [change]);
  const selectView = useCallback((value: string) => change({ view: value as OrderReportView }), [change]);
  const selectPage = useCallback((page: number) => {
    setFilters(value => ({ ...value, page: Math.max(0, page) }));
  }, []);
  return {
    filters, period, choosePeriod, draftStart, draftEnd, updateStart, updateEnd, applyDates, dateError,
    report, rows, businesses, error, loading, refreshing, refresh, selectBusiness, selectStatus, selectSort, selectView, selectPage,
  };
}
