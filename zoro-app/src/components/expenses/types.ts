/** One expense line (description + amount) */
export interface ExpenseItem {
  description: string;
  amount: number;
}

/** Expenses grouped by category: each category has an array of line items */
export type CategorizedExpenses = Record<string, ExpenseItem[]>;

/** One file's parsed buckets with a display name (e.g. "Mar 2026") */
export interface BucketsPerFile {
  fileName: string;
  buckets: CategorizedExpenses;
}
