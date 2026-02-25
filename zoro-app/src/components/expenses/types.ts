/** All expense bucket keys including one-off (non-recurring) */
export const BUCKET_KEYS = ['housing', 'food', 'transportation', 'healthcare', 'entertainment', 'other', 'one_time', 'travel'] as const;
/** Recurring buckets only; use for comparing actuals to monthly estimates */
export const RECURRING_BUCKET_KEYS = ['housing', 'food', 'transportation', 'healthcare', 'entertainment', 'other'] as const;
/** One-off buckets only (not part of recurring estimates) */
export const ONE_OFF_BUCKET_KEYS = ['one_time', 'travel'] as const;

/** One expense line (description + amount) */
export interface ExpenseItem {
  description: string;
  amount: number;
}

/** Expenses grouped by category: each category has an array of line items */
export type CategorizedExpenses = Record<string, ExpenseItem[]>;

/** One file's parsed buckets with a display name (e.g. "Mar 2026"). bucketTotals optional when we only have saved totals (no transaction data). */
export interface BucketsPerFile {
  fileName: string;
  buckets: CategorizedExpenses;
  /** When present, use these totals instead of summing buckets (saved month, no transaction data). */
  bucketTotals?: Record<string, number>;
}
