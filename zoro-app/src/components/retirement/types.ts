export interface ExpenseBucket {
  value: number;
  label: string;
  min?: number;
  max?: number;
  step?: number;
}

export interface CountryData {
  flag: string;
  avgMonthly: string;
  multiplier: number;
  currency: string;
  buckets: {
    housing: ExpenseBucket;
    food: ExpenseBucket;
    transportation: ExpenseBucket;
    healthcare: ExpenseBucket;
    entertainment: ExpenseBucket;
    other: ExpenseBucket;
    one_time: ExpenseBucket;
  };
}

export interface Answers {
  lifestyle: string | null;
  country: string;
  housing: string | null;
  healthcare: string | null;
  travel: string | null;
  safety: string | null;
  liquidNetWorth: string | null;
  annualIncomeJob: string | null;
  otherIncome: string | null;
  pension: string | null;
  liabilities: string | null;
}

export interface RetirementResult {
  required: number;
  aggressive: number;
  balanced: number;
  conservative: number;
  annualSpend: number;
  currency: string;
}

export interface SavingsPlan {
  yearsToRetirement: number;
  currentSavings: number;
  targetAmount: number;
  futureValueNeeded: number;
  futureValueOfCurrentSavings: number;
  shortfall: number;
  surplus: number;
  monthlySavingsNeeded: number;
  totalAnnualIncome: number;
  monthlyIncome: number;
  monthlyBuffer: number;
  savingsRate: number;
  hasDetails: boolean;
  hasIncomeData: boolean;
}

export interface Assumptions {
  preRetirementReturn: number;
  inflation: number;
  currentAge: number;
  retirementAge: number;
  yearsToRetirement: number;
}

