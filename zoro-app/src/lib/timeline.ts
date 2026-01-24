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
    title: 'First 10',
    description: '30-minute free portfolio review and planning meeting directly with our founding team',
  },
  {
    count: 100,
    displayCount: '100',
    title: 'First 100',
    description: 'Receive human reviewed email free for 1 year and early access to new features',
  },
  {
    count: 1000,
    displayCount: '1k',
    title: 'First 1,000',
    description: 'We take the RIA exam and offer AI powered comprehensive planning free for 1 year',
  },
  {
    count: 10000,
    displayCount: '10k',
    title: 'First 10,000',
    description: 'Launch as a paid app in the app and play stores, free only for life for early adopters',
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

