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
