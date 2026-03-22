import { DateTime } from 'luxon';

export const DEFAULT_NAG_TIMEZONE = 'UTC';

/** Returns true if `id` is a valid IANA timezone for Luxon. */
export function isValidIanaTimezone(id: string): boolean {
  const t = id.trim();
  if (!t) return false;
  return DateTime.now().setZone(t).isValid;
}

export function normalizeNagTimeZone(tz: string | null | undefined): string {
  const raw = (tz ?? DEFAULT_NAG_TIMEZONE).trim();
  if (!raw) return DEFAULT_NAG_TIMEZONE;
  return isValidIanaTimezone(raw) ? raw : DEFAULT_NAG_TIMEZONE;
}

export function formatNagNextLabel(nextAt: Date, timeZone: string): string {
  const zone = normalizeNagTimeZone(timeZone);
  return DateTime.fromJSDate(nextAt, { zone: 'utc' })
    .setZone(zone)
    .toFormat("yyyy-MM-dd HH:mm (ZZZZ)");
}
