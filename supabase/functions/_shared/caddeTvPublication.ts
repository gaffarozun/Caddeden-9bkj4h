// Pure publication-date processing; never depend on the device or database session timezone.
export function caddeTvPublicationDates(durationDays: number, timestamp = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
  const start_date = `${part('year')}-${part('month')}-${part('day')}`;
  const days = Number.isFinite(durationDays) ? Math.max(0, Math.floor(durationDays)) : 0;
  const end_date = days > 0
    ? new Date(Date.parse(`${start_date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
    : null;
  return { start_date, end_date };
}
