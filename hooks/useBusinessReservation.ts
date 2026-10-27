import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from './useAuth';
import { useBusinessCart } from './useBusinessCart';
import { Business } from '@/services/types';
import { localDate } from '@/services/businessProfileService';
import { createReservation } from '@/services/businessRequestService';
import { maskFullName } from '@/services/authService';
import { getSubCategory } from '@/services/categories';
export function useBusinessReservation(business: Business | null, allowed: boolean, isDemo: boolean) {
  const { authUser } = useAuth(); const { invalidate } = useBusinessCart(); const router = useRouter();
  const [phone, setPhone] = useState(''); const [date, setDate] = useState(''); const [time, setTime] = useState(''); const [guests, setGuests] = useState(2); const [serviceId, setServiceId] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const lock = useRef(false);
  const appointment = !!getSubCategory(business?.category ?? '')?.hasAppointment;
  useEffect(() => { setPhone(authUser?.phone ?? ''); }, [authUser?.id]);
  const dates = useMemo(() => Array.from({ length: 7 }, (_, index) => { const value = new Date(); value.setDate(value.getDate() + index + 1); return { id: localDate(value), label: value.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }), day: value.getDay() }; }).filter(value => !business?.openDays?.length || business.openDays.includes(value.day)), [business?.openDays]);
  const times = useMemo(() => {
    const parse = (value?: string) => { const [h, m] = (value ?? '').split(':').map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null; };
    const start = parse(business?.openTime) ?? 540; let end = parse(business?.closeTime) ?? 1320;
    if (end <= start) end += 1440;
    const slots: { id: string; label: string }[] = [];
    for (let value = start; value < end && slots.length < 48; value += 30) { const label = `${String(Math.floor(value / 60) % 24).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`; slots.push({ id: label, label }); }
    return slots;
  }, [business?.openTime, business?.closeTime]);
  const submit = useCallback(async () => {
    if (!authUser) { router.push('/auth'); return; }
    if (lock.current || !business) return;
    if (isDemo) { setError('Demo işletmede gerçek rezervasyon oluşturulamaz.'); return; }
    if (!allowed) { setError('Bu hesap veya işletme için rezervasyon açık değil.'); return; }
    if (!date || !time || !phone.trim() || (appointment && !serviceId)) { setError('Tarih, saat, telefon ve varsa hizmet seçimini tamamlayın.'); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await createReservation({ business_id: business.id, date, time, phone: phone.trim(), guests: appointment ? 1 : guests, service_id: appointment ? serviceId : null, type: appointment ? 'appointment' : 'reservation', customer_name: maskFullName(authUser.first_name, authUser.last_name, authUser.username) });
      if (result.error) throw new Error(result.error);
      invalidate(); router.push({ pathname: '/history', params: { businessId: business.id, section: 'reservations', scope: 'bookings', bookingType: appointment ? 'appointment' : 'reservation' } });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Talep gönderilemedi.'); }
    finally { setBusy(false); lock.current = false; }
  }, [authUser, business, allowed, isDemo, date, time, phone, appointment, serviceId, guests, invalidate, router]);
  return { phone, setPhone, date, setDate, time, setTime, guests, setGuests, serviceId, setServiceId, busy, error, dates, times, appointment, submit };
}
