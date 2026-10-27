import { customReportDateError, istanbulDay, orderReportRows, reportDateRange, reportDateTime, validReportDay } from '../services/orderReportService';

function check(condition: boolean, message: string) { if (!condition) throw new Error(message); }
export function runOrderReportChecks() {
  check(istanbulDay(new Date('2026-10-22T21:01:00Z')) === '2026-10-23', 'Midnight must use Istanbul time');
  check(istanbulDay(new Date('2026-10-22T20:59:00Z')) === '2026-10-22', 'Before Istanbul midnight');
  check(reportDateTime('2026-10-22T21:01:00Z') === '23.10.2026 · 00:01', 'History must display exact Istanbul time');
  const now = new Date('2026-10-23T12:00:00Z');
  check(reportDateRange('week', now).start === '2026-10-17', 'Last 7 days are inclusive');
  check(reportDateRange('month', now).start === '2026-10-01', 'Month starts on first day');
  check(reportDateRange('all', now).start === null && reportDateRange('all', now).end === null, 'All history has no date cap');
  check(validReportDay('2024-02-29') && !validReportDay('2026-02-29'), 'Leap days must validate');
  check(!validReportDay('2026-13-01') && !validReportDay('2026-10-32'), 'Invalid calendar dates rejected');
  check(!!customReportDateError('2026-10-24', '2026-10-23'), 'Reversed dates rejected');
  check(!customReportDateError('2026-10-23', '2026-10-23'), 'Same-day report allowed');
  check(orderReportRows(null, 'orders').length === 0, 'No fabricated orders');
}
