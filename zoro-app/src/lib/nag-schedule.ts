import type { NagEndType, NagFrequency, NagRow } from './nag-types';
import { isoWeekdayToUtcJs, parseHHMM } from './nag-types';

function daysInUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function utcAt(y: number, mo: number, d: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(y, mo, d, hour, minute, 0, 0));
}

/** Next calendar date (UTC) at given wall time */
function withUtcTime(baseUtc: Date, hour: number, minute: number): Date {
  return utcAt(
    baseUtc.getUTCFullYear(),
    baseUtc.getUTCMonth(),
    baseUtc.getUTCDate(),
    hour,
    minute
  );
}

/**
 * First fire time >= `from` (UTC semantics for time_hhmm and calendar dates).
 */
export function computeInitialNextAt(input: {
  frequency: NagFrequency;
  time_hhmm: string;
  day_of_week: number | null;
  day_of_month: number | null;
  until_date: string | null;
  from?: Date;
}): Date | null {
  const from = input.from ?? new Date();
  const tm = parseHHMM(input.time_hhmm);
  if (!tm) return null;

  if (input.frequency === 'once') {
    if (!input.until_date) return null;
    const [y, mo, d] = input.until_date.split('-').map(Number);
    const candidate = utcAt(y, mo - 1, d, tm.hour, tm.minute);
    if (candidate.getTime() <= from.getTime()) return null;
    return candidate;
  }

  if (input.frequency === 'daily') {
    let cand = withUtcTime(from, tm.hour, tm.minute);
    if (cand.getTime() <= from.getTime()) {
      const n = new Date(from.getTime());
      n.setUTCDate(n.getUTCDate() + 1);
      cand = withUtcTime(n, tm.hour, tm.minute);
    }
    return cand;
  }

  if (input.frequency === 'weekly') {
    if (input.day_of_week === null) return null;
    const targetJs = isoWeekdayToUtcJs(input.day_of_week);
    const addDays = (targetJs - from.getUTCDay() + 7) % 7;
    const base = new Date(from.getTime());
    base.setUTCDate(base.getUTCDate() + addDays);
    let cand = withUtcTime(base, tm.hour, tm.minute);
    if (cand.getTime() <= from.getTime()) {
      base.setUTCDate(base.getUTCDate() + 7);
      cand = withUtcTime(base, tm.hour, tm.minute);
    }
    return cand;
  }

  if (input.frequency === 'monthly') {
    if (input.day_of_month === null) return null;
    let y = from.getUTCFullYear();
    let mo = from.getUTCMonth();
    const dim = daysInUtcMonth(y, mo);
    const dom = Math.min(input.day_of_month, dim);
    let cand = utcAt(y, mo, dom, tm.hour, tm.minute);
    if (cand.getTime() <= from.getTime()) {
      mo += 1;
      if (mo > 11) {
        mo = 0;
        y += 1;
      }
      const dim2 = daysInUtcMonth(y, mo);
      const dom2 = Math.min(input.day_of_month, dim2);
      cand = utcAt(y, mo, dom2, tm.hour, tm.minute);
    }
    return cand;
  }

  return null;
}

function endOfUntilDateUtcMs(untilDate: string): number {
  const [y, mo, d] = untilDate.split('-').map(Number);
  return Date.UTC(y, mo - 1, d, 23, 59, 59, 999);
}

function isPastEnd(nextAt: Date, endType: NagEndType, untilDate: string | null): boolean {
  if (endType === 'until_date' && untilDate) {
    return nextAt.getTime() > endOfUntilDateUtcMs(untilDate);
  }
  return false;
}

/**
 * After a successful send at `sentAt`, compute the next fire time or mark done.
 */
export function computeNextAfterSend(row: NagRow, sentAt: Date): { next_at: Date | null; status?: 'archived'; occurrences_remaining: number | null } {
  const tm = parseHHMM(row.time_hhmm);
  if (!tm) return { next_at: null, status: 'archived', occurrences_remaining: row.occurrences_remaining };

  let occRem = row.occurrences_remaining;

  if (row.end_type === 'occurrences' && occRem !== null) {
    occRem = occRem - 1;
    if (occRem <= 0) {
      return { next_at: null, status: 'archived', occurrences_remaining: 0 };
    }
  }

  if (row.frequency === 'once') {
    return { next_at: null, status: 'archived', occurrences_remaining: occRem };
  }

  let next: Date | null = null;
  const base = new Date(sentAt.getTime());

  if (row.frequency === 'daily') {
    base.setUTCDate(base.getUTCDate() + 1);
    next = withUtcTime(base, tm.hour, tm.minute);
  } else if (row.frequency === 'weekly') {
    if (row.day_of_week === null) return { next_at: null, status: 'archived', occurrences_remaining: occRem };
    base.setUTCDate(base.getUTCDate() + 7);
    next = withUtcTime(base, tm.hour, tm.minute);
  } else if (row.frequency === 'monthly') {
    if (row.day_of_month === null) return { next_at: null, status: 'archived', occurrences_remaining: occRem };
    const cursor = new Date(sentAt.getTime());
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    const y = cursor.getUTCFullYear();
    const mo = cursor.getUTCMonth();
    const dim = daysInUtcMonth(y, mo);
    const dom = Math.min(row.day_of_month, dim);
    next = utcAt(y, mo, dom, tm.hour, tm.minute);
    if (next.getTime() <= sentAt.getTime()) {
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      const y2 = cursor.getUTCFullYear();
      const mo2 = cursor.getUTCMonth();
      const dim2 = daysInUtcMonth(y2, mo2);
      const dom2 = Math.min(row.day_of_month, dim2);
      next = utcAt(y2, mo2, dom2, tm.hour, tm.minute);
    }
  }

  if (!next) {
    return { next_at: null, status: 'archived', occurrences_remaining: occRem };
  }

  if (isPastEnd(next, row.end_type, row.until_date)) {
    return { next_at: null, status: 'archived', occurrences_remaining: occRem };
  }

  return { next_at: next, occurrences_remaining: occRem };
}
