import React, { createContext, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useApp } from '@/hooks/useApp';
import { useAccountAccess } from '@/hooks/useAccountAccess';
import { useRatings } from '@/hooks/useRatings';
import { useOrderMessages } from '@/hooks/useOrderMessages';
import { fetchOrderRatingPrompts, OrderRatingPrompt, submitOrderBusinessRating, visibleOrderRatingPrompts } from '@/services/orderRatingService';
import { isHalfStarRating } from '@/services/ratingService';

export interface OrderRatingsContextType {
  current: OrderRatingPrompt | null;
  selected: number;
  busy: boolean;
  error: string;
  notice: string;
  choose: (rating: number) => void;
  submit: () => Promise<boolean>;
  postpone: () => void;
  closeNotice: () => void;
}
export const OrderRatingsContext = createContext<OrderRatingsContextType | undefined>(undefined);

export function OrderRatingsProvider({ children }: { children: ReactNode }) {
  const { authUser, loading, profileError, passwordRecovery } = useAuth();
  const { notificationsEnabled, hydrated } = useApp();
  const access = useAccountAccess();
  const { refresh: refreshRatings } = useRatings();
  const { clearDeliveredMessages } = useOrderMessages();
  const userId = access.customer && !loading && !profileError && !passwordRecovery ? authUser?.id ?? '' : '';
  const [openedBefore, setOpenedBefore] = useState(() => new Date().toISOString());
  const [foreground, setForeground] = useState(!AppState.currentState || AppState.currentState === 'active');
  const [items, setItems] = useState<OrderRatingPrompt[]>([]);
  const [owner, setOwner] = useState('');
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const generation = useRef(0);
  const lock = useRef(false);
  const postponed = useRef(new Set<string>());
  const postponeScope = useRef('');
  const previousAppState = useRef(AppState.currentState);
  const backgrounded = useRef(AppState.currentState === 'background');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background') backgrounded.current = true;
      setForeground(state === 'active');
      if (state === 'active' && backgrounded.current && previousAppState.current !== 'active') {
        // A real background -> foreground transition is a new opening; transient inactive states are not.
        backgrounded.current = false;
        setOpenedBefore(new Date().toISOString());
      }
      previousAppState.current = state;
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const epoch = ++generation.current;
    let alive = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const scope = `${userId}:${openedBefore}`;
    if (postponeScope.current !== scope) {
      postponeScope.current = scope;
      postponed.current = new Set();
    }
    setOwner(userId); setItems([]); setSelected(0); setBusy(false); setError(''); setNotice('');
    lock.current = false;
    if (!userId || !notificationsEnabled || !hydrated) return;
    const load = async (canRetry: boolean) => {
      try {
        const next = await fetchOrderRatingPrompts(openedBefore);
        if (alive && generation.current === epoch) setItems(visibleOrderRatingPrompts(next, openedBefore, postponed.current));
      } catch {
        // Only retry a failed opening lookup, with the same cutoff. No delivery polling or same-opening prompts.
        if (alive && generation.current === epoch && canRetry) retryTimer = setTimeout(() => { void load(false); }, 10000);
      }
    };
    void load(true);
    return () => { alive = false; generation.current++; if (retryTimer !== undefined) clearTimeout(retryTimer); };
  }, [userId, notificationsEnabled, hydrated, openedBefore]);

  const visible = owner === userId && !!userId && foreground && notificationsEnabled && hydrated;
  const pending = owner === userId ? items[0] ?? null : null;
  const current = visible ? pending : null;
  useEffect(() => {
    // Temporarily hiding for an inactive system window must not reset an in-progress selection.
    setSelected(pending?.mine != null && isHalfStarRating(pending.mine) ? pending.mine : 0);
    setError('');
  }, [pending?.order_id, pending?.mine]);

  const choose = useCallback((rating: number) => {
    if (lock.current || !isHalfStarRating(rating)) return;
    setSelected(rating); setError('');
  }, []);
  const postpone = useCallback(() => {
    if (!current || lock.current) return;
    postponed.current.add(current.order_id);
    clearDeliveredMessages(current.order_id, current.delivered_at);
    setItems(previous => previous.filter(item => item.order_id !== current.order_id));
    setError('');
  }, [current, clearDeliveredMessages]);
  const closeNotice = useCallback(() => { setNotice(''); }, []);
  const submit = useCallback(async () => {
    if (!current || lock.current || !isHalfStarRating(selected)) return false;
    const epoch = generation.current;
    lock.current = true; setBusy(true); setError('');
    try {
      await submitOrderBusinessRating(current.order_id, selected, userId);
      if (generation.current !== epoch) return false;
      clearDeliveredMessages(current.order_id, current.delivered_at);
      // One existing customer/business vote is updated; older orders for that business need no second prompt.
      setItems(previous => previous.filter(item => item.business_id !== current.business_id));
      setNotice(`${current.business_name} için puanınız kaydedildi.`);
      refreshRatings();
      return true;
    } catch (reason) {
      if (generation.current === epoch) setError(reason instanceof Error ? reason.message : 'Değerlendirme gönderilemedi.');
      return false;
    } finally {
      if (generation.current === epoch) { lock.current = false; setBusy(false); }
    }
  }, [current, selected, userId, clearDeliveredMessages, refreshRatings]);

  const value = useMemo(() => ({ current, selected, busy, error, notice: visible ? notice : '', choose, submit, postpone, closeNotice }), [current, selected, busy, error, visible, notice, choose, submit, postpone, closeNotice]);
  return <OrderRatingsContext.Provider value={value}>{children}</OrderRatingsContext.Provider>;
}
