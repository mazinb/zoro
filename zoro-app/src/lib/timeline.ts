export type TimelineMilestoneStatus = 'complete' | 'current' | 'upcoming';

export type TimelineMilestone = {
  count: number;
  displayCount: string;
  title: string;
  description: string;
};

export type TimelineMilestoneWithStatus = TimelineMilestone & {
  status: TimelineMilestoneStatus;
};

export const TIMELINE_MILESTONES: TimelineMilestone[] = [
  {
    count: 10,
    displayCount: '10',
    title: 'Dedicated 1-on-1 Financial Plan Review',
    description: 'Get a comprehensive financial plan review and customized quarterly planning directly from our team to set your foundation.',
  },
  {
    count: 100,
    displayCount: '100',
    title: 'AI-Powered Financial Plan Review & Human Validation',
    description: 'Receive AI-generated financial plan reviews via email, validated by our experts, with quarterly planning free for one year.',
  },
  {
    count: 1000,
    displayCount: '1k',
    title: 'Registered Investment Advice & AI Planning',
    description: 'Once we obtain our RIA license, get free access to AI-powered comprehensive financial planning and tailored portfolio updates for one year.',
  },
  {
    count: 10000,
    displayCount: '10k',
    title: 'Lifetime Access to Paid App',
    description: 'Secure a free-for-life subscription to our mobile app, including RIA-backed stock insights and goal-based portfolio balancing.',
  },
];

export const buildTimelineMilestones = (
  signupCount: number | null | undefined,
): TimelineMilestoneWithStatus[] => {
  const count = typeof signupCount === 'number' ? signupCount : 0;
  let currentAssigned = false;

  return TIMELINE_MILESTONES.map((milestone) => {
    if (count >= milestone.count) {
      return { ...milestone, status: 'complete' };
    }

    if (!currentAssigned) {
      currentAssigned = true;
      return { ...milestone, status: 'current' };
    }

    return { ...milestone, status: 'upcoming' };
  });
};

