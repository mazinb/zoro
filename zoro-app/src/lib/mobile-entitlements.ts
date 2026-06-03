/** Days after [pro_expires_at] that Pro access remains (unpaid / lapsed subscription). */
export const PRO_GRACE_DAYS = 3;

const MS_PER_DAY = 86_400_000;

export type MobileEntitlementsRow = {
  is_pro: boolean;
  pro_expires_at: string | null;
};

/** Pro while paid period + grace; if no expiry timestamp, fall back to [is_pro]. */
export function effectiveIsPro(
  row: MobileEntitlementsRow,
  now: Date = new Date(),
): boolean {
  const expRaw = row.pro_expires_at;
  if (expRaw == null || String(expRaw).trim() === '') {
    return !!row.is_pro;
  }
  const expires = new Date(expRaw);
  if (Number.isNaN(expires.getTime())) return !!row.is_pro;
  const graceEnd = expires.getTime() + PRO_GRACE_DAYS * MS_PER_DAY;
  return now.getTime() < graceEnd;
}

export function isInProGracePeriod(
  row: MobileEntitlementsRow,
  now: Date = new Date(),
): boolean {
  const expRaw = row.pro_expires_at;
  if (expRaw == null || String(expRaw).trim() === '') return false;
  const expires = new Date(expRaw);
  if (Number.isNaN(expires.getTime())) return false;
  const t = now.getTime();
  return t >= expires.getTime() && t < expires.getTime() + PRO_GRACE_DAYS * MS_PER_DAY;
}

export function proGraceEndsAtIso(row: MobileEntitlementsRow): string | null {
  const expRaw = row.pro_expires_at;
  if (expRaw == null || String(expRaw).trim() === '') return null;
  const expires = new Date(expRaw);
  if (Number.isNaN(expires.getTime())) return null;
  return new Date(expires.getTime() + PRO_GRACE_DAYS * MS_PER_DAY).toISOString();
}
