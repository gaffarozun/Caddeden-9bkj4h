// Powered by OnSpace.AI
// Computes a business open/closed status. Two modes:
//  - 'auto': derived from working hours (open/close) + open days.
//  - 'manual': the owner's is_open switch wins; if it contradicts the schedule
//    the out-of-hours override is surfaced ("Saat dışı açık" / "Planlı saatte kapalı").
// Falls back to parsing the free-text `hours` ("09:00 - 22:00") so existing and
// demo businesses work without extra configuration.
import { Business } from './types';

export type StatusMode = 'auto' | 'manual';

export interface OpenStatus {
  open: boolean;
  label: string;
  detail?: string;
  override: boolean;
}

// UI order Monday -> Sunday, mapped to JS Date.getDay() values (0 = Sunday).
export const WEEKDAYS: { label: string; value: number }[] = [
  { label: 'Pzt', value: 1 },
  { label: 'Sal', value: 2 },
  { label: 'Çar', value: 3 },
  { label: 'Per', value: 4 },
  { label: 'Cum', value: 5 },
  { label: 'Cmt', value: 6 },
  { label: 'Paz', value: 0 },
];

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function toMinutes(t?: string | null): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function parseHoursRange(hours?: string | null): { open: string; close: string } | null {
  if (!hours) return null;
  const m = /(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/.exec(hours);
  if (!m) return null;
  return { open: m[1], close: m[2] };
}

export function getOpenStatus(b: Business, now: Date = new Date()): OpenStatus {
  const range =
    b.openTime && b.closeTime ? { open: b.openTime, close: b.closeTime } : parseHoursRange(b.hours);
  const days = b.openDays && b.openDays.length ? b.openDays : ALL_DAYS;
  // Istanbul is UTC+3 year-round; do not use the phone timezone for business hours.
  const istanbul = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const day = istanbul.getUTCDay();
  const nowMin = istanbul.getUTCHours() * 60 + istanbul.getUTCMinutes();

  let scheduled: boolean | null = null;
  if (range) {
    const o = toMinutes(range.open);
    const c = toMinutes(range.close);
    if (o != null && c != null) {
      const within = c > o ? nowMin >= o && nowMin < c : nowMin >= o || nowMin < c;
      const scheduleDay = c <= o && nowMin < c ? (day + 6) % 7 : day;
      scheduled = days.includes(scheduleDay) && within;
    }
  }
  if (scheduled == null && b.openDays && b.openDays.length && !days.includes(day)) {
    scheduled = false;
  }

  // Auto mode: the schedule decides when we can compute it.
  if (b.statusMode === 'auto' && scheduled != null) {
    const closedReason = !days.includes(day) ? 'Bugün kapalı' : 'Çalışma saatleri dışında';
    return {
      open: scheduled,
      label: scheduled ? 'Açık' : 'Kapalı',
      detail: scheduled ? (range ? `${range.close} saatine kadar açık` : undefined) : closedReason,
      override: false,
    };
  }

  // Manual mode (or auto without a usable schedule): the is_open flag wins.
  const open = b.isOpen;
  let detail: string | undefined;
  let override = false;
  if (b.statusMode && scheduled != null && scheduled !== open) {
    override = true;
    detail = open ? 'Saat dışı açık' : 'Planlı saatte şu an kapalı';
  } else if (range && open) {
    detail = `${range.close} saatine kadar`;
  }
  return { open, label: open ? 'Açık' : 'Kapalı', detail, override };
}
