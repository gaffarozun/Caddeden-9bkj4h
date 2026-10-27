export const orderReportPeriods = [
  { id: 'today', label: 'Bugün' }, { id: 'week', label: 'Son 7 gün' },
  { id: 'month', label: 'Bu ay' }, { id: 'all', label: 'Tüm tarihler' }, { id: 'custom', label: 'Tarih aralığı' },
] as const;
export const orderReportViews = [{ id: 'orders', label: 'Sipariş geçmişi' }, { id: 'daily', label: 'Günlük ciro' }] as const;
export const orderReportStatuses = [
  { id: 'all', label: 'Tüm durumlar' }, { id: 'pending', label: 'Bekleyen' },
  { id: 'approved', label: 'Onaylı' }, { id: 'on_the_way', label: 'Yola çıktı' },
  { id: 'delivered', label: 'Teslim edildi' }, { id: 'rejected', label: 'Reddedilen' },
] as const;
export const orderReportSorts = [
  { id: 'newest', label: 'En yeni tarih' }, { id: 'oldest', label: 'En eski tarih' },
  { id: 'highest', label: 'Tutar: yüksekten' }, { id: 'lowest', label: 'Tutar: düşükten' },
] as const;
