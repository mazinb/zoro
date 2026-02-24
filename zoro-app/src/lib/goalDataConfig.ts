/**
 * Goal → required data mapping for the data gate.
 * Insurance is the only standalone goal (no required data).
 */

export type GoalDataType = 'expenses' | 'assets' | 'income';

export type GoalId =
  | 'save'
  | 'invest'
  | 'home'
  | 'insurance'
  | 'tax'
  | 'retirement';

export const GOAL_REQUIRED_DATA: Record<GoalId, GoalDataType[]> = {
  save: ['expenses'],
  home: ['income', 'expenses'],
  invest: ['income', 'assets'],
  retirement: ['expenses', 'assets'],
  tax: ['income', 'assets'],
  insurance: [],
};

export const GOAL_TITLES: Record<GoalId, string> = {
  save: 'Save more consistently',
  home: 'Plan for big purchases',
  invest: 'Invest smarter',
  retirement: 'Retirement planning',
  tax: 'Tax optimization',
  insurance: 'Review insurance',
};

export interface UserDataRow {
  retirement_expense_buckets?: Record<string, { value?: number }> | null;
  assets_answers?: {
    accounts?: unknown[];
    liabilities?: unknown[];
    [key: string]: unknown;
  } | null;
  income_answers?: {
    job?: string;
    yearly?: Record<string, unknown>;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

export interface DataFilled {
  expenses: boolean;
  assets: boolean;
  income: boolean;
}

/**
 * Determine which data types are "filled" from user_data.
 */
export function getDataFilled(userData: UserDataRow | null | undefined): DataFilled {
  if (!userData) {
    return { expenses: false, assets: false, income: false };
  }

  const buckets = userData.retirement_expense_buckets;
  const hasExpenses =
    !!buckets &&
    typeof buckets === 'object' &&
    !Array.isArray(buckets) &&
    Object.keys(buckets).length > 0 &&
    Object.values(buckets).some(
      (v) => v != null && typeof v === 'object' && typeof (v as { value?: number }).value === 'number'
    );

  const assets = userData.assets_answers;
  const hasAssets =
    !!assets &&
    typeof assets === 'object' &&
    !Array.isArray(assets) &&
    ((Array.isArray(assets.accounts) && assets.accounts.length > 0) ||
      (Array.isArray(assets.liabilities) && assets.liabilities.length > 0) ||
      (typeof assets.currency === 'string' && assets.currency.trim() !== ''));

  const income = userData.income_answers;
  const yearly = income && typeof income === 'object' && !Array.isArray(income) ? income.yearly : undefined;
  const hasIncome =
    !!income &&
    typeof income === 'object' &&
    !Array.isArray(income) &&
    ((typeof income.job === 'string' && income.job.trim().length >= 3) ||
      (yearly != null && typeof yearly === 'object' && !Array.isArray(yearly) && Object.keys(yearly).length > 0));

  return {
    expenses: !!hasExpenses,
    assets: !!hasAssets,
    income: !!hasIncome,
  };
}

export function getRequiredDataForGoal(goalId: GoalId): GoalDataType[] {
  return GOAL_REQUIRED_DATA[goalId] ?? [];
}

export function goalHasRequiredData(goalId: GoalId): boolean {
  return (GOAL_REQUIRED_DATA[goalId]?.length ?? 0) > 0;
}
