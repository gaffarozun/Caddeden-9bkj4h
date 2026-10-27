import { getSubCategory } from './categories';
import { Business } from './types';

export type BusinessHistoryScope = 'all' | 'orders' | 'bookings';
export type BusinessBookingType = 'appointment' | 'reservation';

// Category support and the business opt-in must both be present. A default
// allow_reservation=true must not create bookings for unsupported categories.
export function getBusinessCapabilities(business: Business | null) {
  const category = getSubCategory(business?.category);
  const orders = !!business && !!category?.hasOrder && !!business.allowOrder && business.allowMenu !== false;
  const bookingSupported = !!(category?.hasReservation || category?.hasAppointment);
  const bookings = !!business && bookingSupported && business.allowReservation !== false;
  const bookingType: BusinessBookingType = category?.hasAppointment ? 'appointment' : 'reservation';
  const bookingLabel = bookingType === 'appointment' ? 'Randevular' : 'Rezervasyonlar';
  const historyScope: BusinessHistoryScope = orders && bookings ? 'all' : orders ? 'orders' : 'bookings';
  const historyLabel = orders && bookings ? `Siparişler ve ${bookingLabel.toLocaleLowerCase('tr-TR')}` : orders ? 'Siparişler' : bookings ? bookingLabel : '';
  return { orders, bookings, bookingType, bookingLabel, historyScope, historyLabel };
}
