import type { McpLandingTool } from '@/components/mcp/types';

export type GoalsLandingSection = 'overview' | 'detail';

const sectionLabel: Record<GoalsLandingSection, string> = {
  overview: 'Overview',
  detail: 'Detail',
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
      data: { goals: { save: { complete: false } }, paths: { save: '/save?token=YOUR_TOKEN' } },
    }),
  },
  {
    id: 'goals.detail',
    mcpName: 'goals.detail',
    rowTitle: 'goals.detail',
    section: 'detail',
    description: 'Full goal answers from user_data (optional fields= save,home,invest,insurance,tax,retirement).',
    method: 'GET',
    path: '/api/goals/detail?token=YOUR_TOKEN&fields=save,home,invest',
    mockResponse: () => ({ success: true, data: { save: { target: 100000 } } }),
  },
];

