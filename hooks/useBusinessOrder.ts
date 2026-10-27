import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAlert } from '@/template';
import { useAuth } from './useAuth';
import { useBusinessCart } from './useBusinessCart';
import { Business } from '@/services/types';
import { maskFullName } from '@/services/authService';
import { fetchBusinessDetail } from '@/services/businessService';
import { getBusinessOwnerId } from '@/services/businessRequestService';
import { locateDelivery, submitDeliveryOrder } from '@/services/businessCheckoutService';
import { getOpenStatus } from '@/services/businessStatus';
export function useBusinessOrder(business: Business | null, canOrder: boolean) {
  const { authUser } = useAuth(); const { carts, change, clear, invalidate } = useBusinessCart();
  const router = useRouter(); const { showAlert } = useAlert(); const id = business?.id ?? '';
  const cart = carts[id] ?? {};
  const [contactOpen, setContactOpen] = useState(false); const [phone, setPhone] = useState(''); const [address, setAddress] = useState(''); const [note, setNote] = useState('');
  const [lat, setLat] = useState<number | null>(null); const [lng, setLng] = useState<number | null>(null);
  const [busy, setBusy] = useState(false); const [locating, setLocating] = useState(false); const [error, setError] = useState(''); const lock = useRef(false);
  useEffect(() => { setPhone(authUser?.phone ?? ''); setAddress(authUser?.address ?? ''); setLat(authUser?.lat ?? null); setLng(authUser?.lng ?? null); setNote(''); setContactOpen(false); setError(''); }, [authUser?.id, id]);
  const items = useMemo(() => (business?.menu ?? []).filter(item => (cart[item.id] ?? 0) > 0).map(item => ({ item, qty: cart[item.id] })), [business?.menu, cart]);
  const total = items.reduce((sum, row) => sum + row.item.price * row.qty, 0); const count = items.reduce((sum, row) => sum + row.qty, 0);
  const minimum = Math.max(0, business?.minOrder ?? 0); const remaining = Math.max(0, minimum - total);
  const add = useCallback((itemId: string, delta: number) => { if (canOrder && !lock.current) change(id, itemId, delta); }, [id, canOrder, change]);
  const checkout = useCallback(() => {
    if (!authUser) { router.push('/auth'); return; }
    if (!canOrder || !business || !items.length) return;
    if (!getOpenStatus(business).open) { showAlert('İşletme kapalı', 'Siparişinizi işletme açıkken gönderebilirsiniz.'); return; }
    setError(''); setContactOpen(true);
  }, [authUser, router, canOrder, business, items.length, showAlert]);
  const locate = useCallback(async () => {
    setLocating(true); setError('');
    try { const location = await locateDelivery(); setLat(location.lat); setLng(location.lng); setAddress(value => value.trim() ? value : location.address); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Konum alınamadı.'); }
    finally { setLocating(false); }
  }, []);
  const submit = useCallback(async () => {
    if (lock.current || !canOrder || !business || !authUser || !items.length || remaining > 0) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const [fresh, owner] = await Promise.all([fetchBusinessDetail(id), getBusinessOwnerId(id)]);
      if (!fresh || !fresh.allowOrder || fresh.allowMenu === false || owner === authUser.id || authUser.role !== 'user' || !getOpenStatus(fresh).open) throw new Error('Bu işletmeden şu anda sipariş verilemiyor.');
      const currentItems = items.map(row => { const item = fresh.menu.find(value => value.id === row.item.id); if (!item) throw new Error('Sepetteki bir ürün artık mevcut değil. Menüyü yenileyin.'); return { menu_item_id: item.id, name: item.name, price: item.price, qty: row.qty }; });
      const currentTotal = currentItems.reduce((sum, item) => sum + item.price * item.qty, 0);
      if (currentTotal !== total || Number(fresh.minOrder ?? 0) !== minimum) throw new Error('Menü fiyatları veya minimum tutar değişti. Menüyü yenileyip tekrar deneyin.');
      await submitDeliveryOrder({ business_id: id, items: currentItems, total: currentTotal, phone: phone.trim(), address: address.trim(), lat, lng, note: note.trim() || null, customer_name: maskFullName(authUser.first_name, authUser.last_name, authUser.username) });
      clear(id); invalidate(); setContactOpen(false); setNote('');
      router.push({ pathname: '/history', params: { businessId: id, mode: 'active' } });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Sipariş gönderilemedi.'); }
    finally { lock.current = false; setBusy(false); }
  }, [canOrder, business, authUser, items, remaining, id, total, minimum, phone, address, lat, lng, note, clear, invalidate, router]);
  return { cart, items, total, count, minimum, remaining, add, checkout, contactOpen, closeContact: () => { if (!busy) setContactOpen(false); }, phone, setPhone, address, setAddress, note, setNote, lat, locate, locating, busy, error, submit };
}
