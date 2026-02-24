/**
 * Currency conversion helpers. Use rates from GET /api/currency-rates when available;
 * fall back to these static rates (e.g. when month has no rate in DB).
 */
export const FALLBACK_RATES_TO_INR: Record<string, number> = {
  India: 1,
  Thailand: 2.2,
  UAE: 22,
  Europe: 90,
  US: 83,
  Other: 83,
};

export const CURRENCY_CODES = Object.keys(FALLBACK_RATES_TO_INR);

/** Convert amount in given currency to INR using provided rate, or fallback rate. */
export function convertToInr(
  amount: number,
  currencyCode: string,
  rateFromApi: number | undefined
): number {
  const rate = rateFromApi ?? FALLBACK_RATES_TO_INR[currencyCode] ?? 1;
  return amount * rate;
}

/** Get rate for currency (from API rates object or fallback). */
export function getRateToInr(
  currencyCode: string,
  ratesByMonth?: Record<string, number>,
  monthKey?: string
): number {
  if (ratesByMonth && monthKey && ratesByMonth[currencyCode] != null) {
    return ratesByMonth[currencyCode];
  }
  return FALLBACK_RATES_TO_INR[currencyCode] ?? 1;
}

/** Format month as YYYY-MM from a Date or ISO string. */
export function toMonthKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

/** Current month YYYY-MM. */
export function currentMonthKey(): string {
  return toMonthKey(new Date());
}

/** For a year (e.g. "2024"), return representative month key for rate lookup (June). */
export function yearToMonthKey(year: string): string {
  const y = parseInt(year, 10);
  if (Number.isNaN(y)) return currentMonthKey();
  return `${y}-06`;
}

/** Convert amount from one currency to another using rates for a given month. */
export function convertBetweenCurrencies(
  amount: number,
  monthKey: string,
  fromCurrency: string,
  toCurrency: string,
  ratesByMonth: Record<string, Record<string, number>>
): number {
  if (fromCurrency === toCurrency) return amount;
  const rates = ratesByMonth[monthKey];
  const rateFrom = getRateToInr(fromCurrency, rates, monthKey);
  const rateTo = getRateToInr(toCurrency, rates, monthKey);
  if (rateTo === 0) return amount;
  return amount * (rateFrom / rateTo);
}
