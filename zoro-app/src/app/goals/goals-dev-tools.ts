import type { McpLandingTool } from '@/components/mcp/types';

export type GoalsLandingSection = 'overview' | 'detail' | 'save';

const sectionLabel: Record<GoalsLandingSection, string> = {
  overview: 'Overview',
  detail: 'Detail',
  save: 'Onboarding (save)',
};

export function goalsSectionTitle(s: string): string {
  return sectionLabel[s as GoalsLandingSection] ?? s;
}

export const GOALS_LANDING_TOOLS: McpLandingTool[] = [
  {
    id: 'goals.overview',
    mcpName: 'goals.overview',
    rowTitle: 'goals.overview',
    section: 'overview',
    description: 'Snapshot: which goal forms have data + tokenized URLs.',
    method: 'GET',
    path: '/api/orchestrator/summary?token=YOUR_TOKEN',
    mockResponse: () => ({
      success: true,
      data: {
        user: { id: 'user', email: 'you@example.com', timezone: 'UTC' },
        goals: { save_more: false, big_purchase: true, invest: false, insurance: false, tax: false, retirement: false },
        paths: { save: '/save?token=YOUR_TOKEN', home_big_purchase: '/home?token=YOUR_TOKEN' },
      },
    }),
  },
  {
    id: 'goals.detail_goal_save',
    mcpName: 'goals.detail_goal',
    rowTitle: 'goals.detail_goal · save',
    section: 'detail',
    description: 'Fetch full answers for the Save goal + `wealth_data_filled` for GoalDataGate.',
    method: 'GET',
    path: '/api/goals/detail?token=YOUR_TOKEN&fields=save',
    mockResponse: () => ({
      success: true,
      data: {
        wealth_data_filled: { expenses: true, assets: true, income: false },
        goals: {
          save: { title: 'Save more consistently', answers: { example: true }, path: '/save?token=YOUR_TOKEN' },
        },
      },
    }),
  },
  {
    id: 'goals.detail_goal_home',
    mcpName: 'goals.detail_goal',
    rowTitle: 'goals.detail_goal · home',
    section: 'detail',
    description: 'Fetch full answers for the Home (big purchase) goal + `wealth_data_filled` for GoalDataGate.',
    method: 'GET',
    path: '/api/goals/detail?token=YOUR_TOKEN&fields=home',
    mockResponse: () => ({
      success: true,
      data: {
        wealth_data_filled: { expenses: true, assets: false, income: true },
        goals: {
          home: { title: 'Plan for big purchases', answers: { example: true }, path: '/home?token=YOUR_TOKEN' },
        },
      },
    }),
  },
  {
    id: 'goals.detail_goal_invest',
    mcpName: 'goals.detail_goal',
    rowTitle: 'goals.detail_goal · invest',
    section: 'detail',
    description: 'Fetch full answers for the Invest goal + `wealth_data_filled` for GoalDataGate.',
    method: 'GET',
    path: '/api/goals/detail?token=YOUR_TOKEN&fields=invest',
    mockResponse: () => ({
      success: true,
      data: {
        wealth_data_filled: { expenses: false, assets: true, income: true },
        goals: {
          invest: { title: 'Invest smarter', answers: { example: true }, path: '/invest?token=YOUR_TOKEN' },
        },
      },
    }),
  },
  {
    id: 'goals.detail_goal_insurance',
    mcpName: 'goals.detail_goal',
    rowTitle: 'goals.detail_goal · insurance',
    section: 'detail',
    description: 'Fetch full answers for the Insurance goal + `wealth_data_filled` (may be unused) for GoalDataGate.',
    method: 'GET',
    path: '/api/goals/detail?token=YOUR_TOKEN&fields=insurance',
    mockResponse: () => ({
      success: true,
      data: {
        wealth_data_filled: { expenses: false, assets: false, income: false },
        goals: {
          insurance: { title: 'Review insurance', answers: { example: true }, path: '/insurance?token=YOUR_TOKEN' },
        },
      },
    }),
  },
  {
    id: 'goals.detail_goal_tax',
    mcpName: 'goals.detail_goal',
    rowTitle: 'goals.detail_goal · tax',
    section: 'detail',
    description: 'Fetch full answers for the Tax goal + `wealth_data_filled` for GoalDataGate.',
    method: 'GET',
    path: '/api/goals/detail?token=YOUR_TOKEN&fields=tax',
    mockResponse: () => ({
      success: true,
      data: {
        wealth_data_filled: { expenses: true, assets: true, income: true },
        goals: {
          tax: { title: 'Tax optimization', answers: { example: true }, path: '/tax?token=YOUR_TOKEN' },
        },
      },
    }),
  },
  {
    id: 'goals.detail_goal_retirement',
    mcpName: 'goals.detail_goal',
    rowTitle: 'goals.detail_goal · retirement',
    section: 'detail',
    description: 'Fetch full answers for the Retirement goal + `wealth_data_filled` for GoalDataGate.',
    method: 'GET',
    path: '/api/goals/detail?token=YOUR_TOKEN&fields=retirement',
    mockResponse: () => ({
      success: true,
      data: {
        wealth_data_filled: { expenses: true, assets: false, income: false },
        goals: {
          retirement: { title: 'Retirement planning', answers: { example: true }, path: '/retire?token=YOUR_TOKEN' },
        },
      },
    }),
  },

  // Save/onboarding tools: these write `user_data` columns via /api/user-data
  {
    id: 'goals.save.save_more',
    mcpName: 'goals.save.save_more',
    rowTitle: 'goals.save.save_more',
    section: 'save',
    description: 'Save the Save-More goal (POSTs to /api/user-data with formType save_more).',
    method: 'POST',
    path: '/api/user-data',
    sampleBody: { token: 'YOUR_TOKEN', formType: 'save_more', formData: { existingCash: '1000', currency: 'USD' } },
    mockResponse: () => ({ success: true, token: 'YOUR_TOKEN', data: { formType: 'save_more' } }),
  },
  {
    id: 'goals.home.save_big_purchase',
    mcpName: 'goals.home.save_big_purchase',
    rowTitle: 'goals.home.save_big_purchase',
    section: 'save',
    description: 'Save the Big-Purchase (Home) goal (POSTs to /api/user-data with formType big_purchase).',
    method: 'POST',
    path: '/api/user-data',
    sampleBody: { token: 'YOUR_TOKEN', formType: 'big_purchase', formData: { purchase: 'Car', deadline: '2026-06' } },
    mockResponse: () => ({ success: true, token: 'YOUR_TOKEN', data: { formType: 'big_purchase' } }),
  },
  {
    id: 'goals.invest.save_invest',
    mcpName: 'goals.invest.save_invest',
    rowTitle: 'goals.invest.save_invest',
    section: 'save',
    description: 'Save the Invest goal (POSTs to /api/user-data with formType invest).',
    method: 'POST',
    path: '/api/user-data',
    sampleBody: { token: 'YOUR_TOKEN', formType: 'invest', formData: { investmentGoal: 'Retirement', riskTolerance: 'medium' } },
    mockResponse: () => ({ success: true, token: 'YOUR_TOKEN', data: { formType: 'invest' } }),
  },
  {
    id: 'goals.insurance.save_insurance',
    mcpName: 'goals.insurance.save_insurance',
    rowTitle: 'goals.insurance.save_insurance',
    section: 'save',
    description: 'Save the Insurance goal (POSTs to /api/user-data with formType insurance).',
    method: 'POST',
    path: '/api/user-data',
    sampleBody: { token: 'YOUR_TOKEN', formType: 'insurance', formData: { householdSize: '3' } },
    mockResponse: () => ({ success: true, token: 'YOUR_TOKEN', data: { formType: 'insurance' } }),
  },
  {
    id: 'goals.tax.save_tax',
    mcpName: 'goals.tax.save_tax',
    rowTitle: 'goals.tax.save_tax',
    section: 'save',
    description: 'Save the Tax goal (POSTs to /api/user-data with formType tax).',
    method: 'POST',
    path: '/api/user-data',
    sampleBody: { token: 'YOUR_TOKEN', formType: 'tax', formData: { currency: 'USD', grossIncome: '120000' } },
    mockResponse: () => ({ success: true, token: 'YOUR_TOKEN', data: { formType: 'tax' } }),
  },
  {
    id: 'goals.retirement.save_retirement',
    mcpName: 'goals.retirement.save_retirement',
    rowTitle: 'goals.retirement.save_retirement',
    section: 'save',
    description: 'Save the Retirement goal (POSTs to /api/user-data with formType retirement).',
    method: 'POST',
    path: '/api/user-data',
    sampleBody: {
      token: 'YOUR_TOKEN',
      formType: 'retirement',
      formData: { country: 'US', housing: 'Rent', liquidNetWorth: '250000' },
      expenseBuckets: { healthcare: { value: 3000 }, travel: { value: 1000 } },
    },
    mockResponse: () => ({ success: true, token: 'YOUR_TOKEN', data: { formType: 'retirement' } }),
  },
];

