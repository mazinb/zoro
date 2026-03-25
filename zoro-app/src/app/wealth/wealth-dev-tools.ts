import type { McpLandingTool } from '@/components/mcp/types';

export type WealthLandingSection =
  | 'data'
  | 'expenses'
  | 'income'
  | 'assets'
  | 'reminders'
  | 'fx';

const sectionLabel: Record<WealthLandingSection, string> = {
  data: 'Data',
  expenses: 'Expenses',
  income: 'Income',
  assets: 'Assets',
  reminders: 'Reminders',
  fx: 'FX',
};

export function wealthSectionTitle(s: string): string {
  return sectionLabel[s as WealthLandingSection] ?? s;
}

export const WEALTH_LANDING_TOOLS: McpLandingTool[] = [
  {
    id: 'wealth.user_data',
    mcpName: 'wealth.user_data',
    rowTitle: 'wealth.user_data',
    section: 'data',
    description: 'Load the full `user_data` row used across wealth + goals.',
    method: 'GET',
    path: '/api/user-data?token=YOUR_TOKEN',
    mockResponse: () => ({ success: true, data: { email: 'you@example.com', shared_data: {} } }),
  },
  {
    id: 'wealth.expenses_monthly',
    mcpName: 'wealth.expenses.monthly',
    rowTitle: 'wealth.expenses.monthly',
    section: 'expenses',
    description: 'Get monthly expense buckets for one month, or list stored months.',
    method: 'GET',
    path: '/api/expenses/monthly?token=YOUR_TOKEN&month=2026-03',
    mockResponse: () => ({ success: true, months: ['2026-01', '2026-02', '2026-03'] }),
  },
  {
    id: 'wealth.expenses_estimates',
    mcpName: 'wealth.expenses.estimates',
    rowTitle: 'wealth.expenses.estimates',
    section: 'expenses',
    description: 'List expense estimate snapshots (or latest only).',
    method: 'GET',
    path: '/api/expenses/estimates?token=YOUR_TOKEN&latest=1',
    mockResponse: () => ({ success: true, latest: { buckets: { housing: { value: 1200 } } } }),
  },
  {
    id: 'wealth.expenses.set_estimates',
    mcpName: 'wealth.expenses.set_estimates',
    rowTitle: 'wealth.expenses.set_estimates',
    section: 'expenses',
    description: 'Save expense estimate buckets (client must supply totals; no server-side parsing).',
    method: 'POST',
    path: '/api/expenses/estimates',
    sampleBody: {
      token: 'YOUR_TOKEN',
      buckets: {
        housing: { value: 1200 },
        food: { value: 500 },
        transportation: { value: 200 },
        healthcare: { value: 150 },
        entertainment: { value: 120 },
        other: { value: 100 },
        one_time: { value: 0 },
        travel: { value: 0 },
      },
      comparedToActuals: false,
    },
    mockResponse: () => ({ success: true }),
  },
  {
    id: 'wealth.expenses.save_monthly_actuals_totals',
    mcpName: 'wealth.expenses.save_monthly_actuals_totals',
    rowTitle: 'wealth.expenses.save_monthly_actuals_totals',
    section: 'expenses',
    description: 'Save a month’s actual expense totals (category totals only).',
    method: 'POST',
    path: '/api/expenses/monthly',
    sampleBody: {
      token: 'YOUR_TOKEN',
      month: '2026-03',
      buckets: {
        housing: { value: 1200 },
        food: { value: 500 },
        transportation: { value: 200 },
        healthcare: { value: 150 },
        entertainment: { value: 120 },
        other: { value: 100 },
        one_time: { value: 0 },
        travel: { value: 0 },
      },
      finalizeImport: true,
    },
    mockResponse: () => ({ success: true, month: '2026-03' }),
  },
  {
    id: 'wealth.income.save',
    mcpName: 'wealth.income.save',
    rowTitle: 'wealth.income.save',
    section: 'income',
    description: 'Save income answers (client supplies structured values).',
    method: 'POST',
    path: '/api/user-data',
    sampleBody: {
      token: 'YOUR_TOKEN',
      formType: 'income',
      formData: { yearly: { '2026': { baseSalary: 120000, bonus: 20000 } } },
      sharedData: { income_country: 'US' },
    },
    mockResponse: () => ({ success: true }),
  },
  {
    id: 'wealth.assets.save',
    mcpName: 'wealth.assets.save',
    rowTitle: 'wealth.assets.save',
    section: 'assets',
    description: 'Save assets + liabilities (client supplies structured values).',
    method: 'POST',
    path: '/api/user-data',
    sampleBody: {
      token: 'YOUR_TOKEN',
      formType: 'assets',
      formData: { accounts: [{ type: 'savings', currency: 'US', total: 15000 }] },
      sharedData: { assets_country: 'US' },
    },
    mockResponse: () => ({ success: true }),
  },
  {
    id: 'wealth.reminders.list',
    mcpName: 'wealth.reminders.list',
    rowTitle: 'wealth.reminders.list',
    section: 'reminders',
    description: 'List reminders created via the main-site “Add reminder” widget.',
    method: 'GET',
    path: '/api/reminders?token=YOUR_TOKEN',
    mockResponse: () => ({ reminders: [] }),
  },
  {
    id: 'wealth.reminders.create',
    mcpName: 'wealth.reminders.create',
    rowTitle: 'wealth.reminders.create',
    section: 'reminders',
    description: 'Create a lightweight reminder (for email/WhatsApp/webhooks schedules use Nags).',
    method: 'POST',
    path: '/api/reminders',
    sampleBody: { token: 'YOUR_TOKEN', description: 'Review expenses', context: 'expenses', recurrence: 'monthly', recurrence_day: 1 },
    mockResponse: () => ({ success: true }),
  },
  {
    id: 'wealth.reminders.delete',
    mcpName: 'wealth.reminders.delete',
    rowTitle: 'wealth.reminders.delete',
    section: 'reminders',
    description: 'Delete a reminder row by id.',
    method: 'DELETE',
    path: '/api/reminders?token=YOUR_TOKEN&id=REMINDER_ID',
    mockResponse: () => ({ success: true }),
  },
  {
    id: 'wealth.currency_rates',
    mcpName: 'wealth.fx.rates',
    rowTitle: 'wealth.fx.rates',
    section: 'fx',
    description: 'List stored FX rates (optional month=YYYY-MM).',
    method: 'GET',
    path: '/api/currency-rates?token=YOUR_TOKEN&month=2026-03',
    mockResponse: () => ({ success: true, rates: [{ month: '2026-03', base: 'USD', quote: 'INR', rate: 83.1 }] }),
  },
  {
    id: 'wealth.currency_coverage',
    mcpName: 'wealth.fx.coverage',
    rowTitle: 'wealth.fx.coverage',
    section: 'fx',
    description: 'Report missing (month, currency) FX pairs for the user.',
    method: 'GET',
    path: '/api/currency-rates/coverage?token=YOUR_TOKEN',
    mockResponse: () => ({ success: true, missing: [] }),
  },
];

