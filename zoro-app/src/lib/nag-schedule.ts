import { DateTime } from 'luxon';
import type { NagEndType, NagFrequency, NagRow } from './nag-types';
import { defaultFollowupHoursForFrequency, parseHHMM } from './nag-types';
import { DEFAULT_NAG_TIMEZONE, normalizeNagTimeZone } from './nag-timezone';

/** ISO weekday 0 = Monday … 6 = Sunday → Luxon weekday (Monday = 1 … Sunday = 7). */
function isoWeekdayToLuxon(iso: number): number {
  return iso + 1;
}

function endOfUntilDateInZone(untilDate: string, zone: string): DateTime {
  const [y, mo, d] = untilDate.split('-').map(Number);
  return DateTime.fromObject(
    { year: y, month: mo, day: d, hour: 23, minute: 59, second: 59, millisecond: 999 },
    { zone: normalizeNagTimeZone(zone) }
  );
}

function isPastEnd(nextAt: Date, endType: NagEndType, untilDate: string | null, zone: string): boolean {
  if (endType === 'until_date' && untilDate) {
    const end = endOfUntilDateInZone(untilDate, zone);
    if (!end.isValid) return false;
    return nextAt.getTime() > end.toUTC().toMillis();
  }
  return false;
}

/**
 * First fire time >= `from`. `time_hhmm`, `until_date`, and calendar rules use `timeZone` (IANA).
 */
export function computeInitialNextAt(input: {
  frequency: NagFrequency;
  time_hhmm: string;
  day_of_week: number | null;
  day_of_month: number | null;
  until_date: string | null;
  from?: Date;
  timeZone?: string | null;
}): Date | null {
  const zone = normalizeNagTimeZone(input.timeZone ?? DEFAULT_NAG_TIMEZONE);
  const tm = parseHHMM(input.time_hhmm);
  if (!tm) return null;

  const from = input.from ?? new Date();
  const fromZ = DateTime.fromJSDate(from, { zone: 'utc' }).setZone(zone);
  if (!fromZ.isValid) return null;

  if (input.frequency === 'once') {
    if (!input.until_date) return null;
    const [y, mo, d] = input.until_date.split('-').map(Number);
    const cand = DateTime.fromObject(
      { year: y, month: mo, day: d, hour: tm.hour, minute: tm.minute, second: 0, millisecond: 0 },
      { zone }
    );
    if (!cand.isValid) return null;
    const utc = cand.toUTC().toJSDate();
    if (utc.getTime() <= from.getTime()) return null;
    return utc;
  }

  if (input.frequency === 'daily') {
    let cand = fromZ.set({ hour: tm.hour, minute: tm.minute, second: 0, millisecond: 0 });
    if (cand.toMillis() <= from.getTime()) {
      cand = cand.plus({ days: 1 });
    }
    return cand.toUTC().toJSDate();
  }

  if (input.frequency === 'weekly') {
    if (input.day_of_week === null) return null;
    const targetWd = isoWeekdayToLuxon(input.day_of_week);
    const base = fromZ.startOf('day');
    let addDays = (targetWd - base.weekday + 7) % 7;
    let cand = base.plus({ days: addDays }).set({ hour: tm.hour, minute: tm.minute, second: 0, millisecond: 0 });
    if (cand.toMillis() <= from.getTime()) {
      cand = cand.plus({ weeks: 1 });
    }
    return cand.toUTC().toJSDate();
  }

  if (input.frequency === 'monthly') {
    if (input.day_of_month === null) return null;
    let y = fromZ.year;
    let month = fromZ.month;
    const dim0 = DateTime.fromObject({ year: y, month, day: 1 }, { zone }).daysInMonth ?? 31;
    const dom0 = Math.min(input.day_of_month, dim0);
    let cand = DateTime.fromObject(
      { year: y, month, day: dom0, hour: tm.hour, minute: tm.minute, second: 0, millisecond: 0 },
      { zone }
    );
    if (!cand.isValid) return null;
    if (cand.toMillis() <= from.getTime()) {
      cand = cand.plus({ months: 1 });
      y = cand.year;
      month = cand.month;
      const dim1 = DateTime.fromObject({ year: y, month, day: 1 }, { zone }).daysInMonth ?? 31;
      const dom1 = Math.min(input.day_of_month, dim1);
      cand = DateTime.fromObject(
        { year: y, month, day: dom1, hour: tm.hour, minute: tm.minute, second: 0, millisecond: 0 },
        { zone }
      );
    }
    if (!cand.isValid) return null;
    return cand.toUTC().toJSDate();
  }

  return null;
}

/**
 * After a successful send at `sentAt`, compute the next fire time or mark done.
 */
export function computeNextAfterSend(
  row: NagRow,
  sentAt: Date,
  timeZone?: string | null
): { next_at: Date | null; status?: 'archived'; occurrences_remaining: number | null } {
  const zone = normalizeNagTimeZone(timeZone ?? DEFAULT_NAG_TIMEZONE);
  const tm = parseHHMM(row.time_hhmm);
  if (!tm) return { next_at: null, status: 'archived', occurrences_remaining: row.occurrences_remaining };

  let occRem = row.occurrences_remaining;

  if (row.end_type === 'occurrences' && occRem !== null) {
    occRem = occRem - 1;
    if (occRem <= 0) {
      return { next_at: null, status: 'archived', occurrences_remaining: 0 };
    }
  }

  const untilDone = row.nag_until_done === true && row.channel === 'email';
  if (untilDone) {
    const hrs =
      row.followup_interval_hours != null
        ? row.followup_interval_hours
        : defaultFollowupHoursForFrequency(row.frequency);
    const nextFollow = new Date(sentAt.getTime() + hrs * 60 * 60 * 1000);
    // For "nag until done", keep follow-up cycle alive even if the scheduled end date passed.
    return { next_at: nextFollow, occurrences_remaining: occRem };
  }

  if (row.frequency === 'once') {
    return { next_at: null, status: 'archived', occurrences_remaining: occRem };
  }

  const z = DateTime.fromJSDate(sentAt, { zone: 'utc' }).setZone(zone);
  if (!z.isValid) {
    return { next_at: null, status: 'archived', occurrences_remaining: occRem };
  }

  let next: DateTime | null = null;

  if (row.frequency === 'daily') {
    next = z.plus({ days: 1 }).set({ hour: tm.hour, minute: tm.minute, second: 0, millisecond: 0 });
  } else if (row.frequency === 'weekly') {
    if (row.day_of_week === null) return { next_at: null, status: 'archived', occurrences_remaining: occRem };
    next = z.plus({ weeks: 1 }).set({ hour: tm.hour, minute: tm.minute, second: 0, millisecond: 0 });
  } else if (row.frequency === 'monthly') {
    if (row.day_of_month === null) return { next_at: null, status: 'archived', occurrences_remaining: occRem };
    let nextM = z.plus({ months: 1 });
    const dim = nextM.daysInMonth ?? 31;
    const dom = Math.min(row.day_of_month, dim);
    next = DateTime.fromObject(
      { year: nextM.year, month: nextM.month, day: dom, hour: tm.hour, minute: tm.minute, second: 0, millisecond: 0 },
      { zone }
    );
    if (!next.isValid) {
      return { next_at: null, status: 'archived', occurrences_remaining: occRem };
    }
    if (next.toMillis() <= sentAt.getTime()) {
      nextM = nextM.plus({ months: 1 });
      const dim2 = nextM.daysInMonth ?? 31;
      const dom2 = Math.min(row.day_of_month, dim2);
      next = DateTime.fromObject(
        { year: nextM.year, month: nextM.month, day: dom2, hour: tm.hour, minute: tm.minute, second: 0, millisecond: 0 },
        { zone }
      );
    }
  }

  if (!next || !next.isValid) {
    return { next_at: null, status: 'archived', occurrences_remaining: occRem };
  }

  const nextJs = next.toUTC().toJSDate();
  if (isPastEnd(nextJs, row.end_type, row.until_date, zone)) {
    return { next_at: null, status: 'archived', occurrences_remaining: occRem };
  }

  return { next_at: nextJs, occurrences_remaining: occRem };
}
