import { loadEmailTemplate, renderTemplate } from '@/lib/email-templates';

type GoalDetails = Record<
  string,
  { selections?: string[]; other?: string; main?: string; extra?: string }
>;

const goalLabelById: Record<string, string> = {
  save: 'Save more consistently',
  invest: 'Invest smarter',
  home: 'Plan for big purchases',
  insurance: 'Review insurance',
  tax: 'Tax optimization',
  retirement: 'Retirement planning'
};

const interestLineById: Record<string, (baseUrl: string) => string> = {
  retirement: (baseUrl: string) =>
    `You can start with our retirement planner here: ${baseUrl}/retire`
};

const fallbackAiContent =
  "Thanks for sharing a bit about your goals. I'd love to learn more about your priorities, timeline, and any current financial routines so we can tailor a plan that fits you.";

function getBaseUrl() {
  return 'https://www.getzoro.com';
}

function normalizeInterests(body: Record<string, any>) {
  const rawGoals = Array.isArray(body.goals) ? body.goals : [];
  const fallbackGoal = typeof body.primaryGoal === 'string' ? body.primaryGoal : '';
  const goalIds = rawGoals.length > 0 ? rawGoals : fallbackGoal ? [fallbackGoal] : [];
  const goalLabels = goalIds.map((id) => goalLabelById[id] || id);
  return { goalIds, goalLabels };
}

function formatGoalDetails(details: GoalDetails | null | undefined) {
  if (!details || typeof details !== 'object') return null;
  const entries = Object.entries(details)
    .map(([goalId, value]) => {
      const label = goalLabelById[goalId] || goalId;
      const selections = Array.isArray(value?.selections)
        ? value.selections
        : value?.main
          ? [value.main]
          : [];
      const otherText = value?.other || value?.extra || '';
      const base = selections.length > 0 ? selections.join(', ') : '';
      if (!base && !otherText) return null;
      const withOther = otherText
        ? `${base || 'Other'} (Other: ${otherText})`
        : base;
      return `${label}: ${withOther}`;
    });
  const filtered = entries.filter((entry): entry is string => Boolean(entry));
  return filtered.length > 0 ? filtered.join('\n') : null;
}

async function generateAiContent(context: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('OpenAI draft skipped: OPENAI_API_KEY not set');
    return fallbackAiContent;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.6,
        max_tokens: 220,
        messages: [
          {
            role: 'system',
            content:
              'You draft short, warm, professional email content for a financial planning onboarding reply. Return only the body content (2-4 short paragraphs). No greeting, no sign-off, no bullet list unless requested.'
          },
          {
            role: 'user',
            content: context
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      const requestId = response.headers.get('x-request-id') || 'unknown';
      console.error('OpenAI draft failed:', {
        status: response.status,
        requestId,
        error: errorText.slice(0, 500)
      });
      return fallbackAiContent;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    return content || fallbackAiContent;
  } catch (error) {
    console.error('OpenAI draft generation failed:', error);
    return fallbackAiContent;
  }
}

function buildInterestLines(goalIds: string[], baseUrl: string) {
  const lines = goalIds
    .map((goalId) => interestLineById[goalId]?.(baseUrl))
    .filter((line): line is string => Boolean(line));
  return lines;
}

function buildAiContext(body: Record<string, any>, goalLabels: string[]) {
  const formattedGoalDetails = formatGoalDetails(body.goalDetails);
  const details = [
    `Name: ${body.name || 'not provided'}`,
    `Email: ${body.email || 'not provided'}`,
    `Interests: ${goalLabels.length > 0 ? goalLabels.join(', ') : 'not provided'}`,
    body.netWorth ? `Net worth: ${body.netWorth}` : null,
    body.timeHorizon ? `Time horizon: ${body.timeHorizon}` : null,
    body.contactMethod ? `Preferred contact method: ${body.contactMethod}` : null,
    body.additionalInfo ? `Additional info: ${body.additionalInfo}` : null,
    formattedGoalDetails ? `Goal details:\n${formattedGoalDetails}` : null
  ].filter(Boolean);

  return [
    'Write the email body content for the user based on these details:',
    ...details
  ].join('\n');
}

export async function buildDraftResponseEmail(body: Record<string, any>) {
  const { goalIds, goalLabels } = normalizeInterests(body);
  const baseUrl = getBaseUrl();
  const interestLines = buildInterestLines(goalIds, baseUrl).join('\n');
  const aiContext = buildAiContext(body, goalLabels);
  const aiContent = await generateAiContent(aiContext);
  const template = await loadEmailTemplate('welcome-reply');
  const waitlistPosition =
    body.waitlistPosition !== null && body.waitlistPosition !== undefined
      ? String(body.waitlistPosition)
      : 'TBD';
  const rendered = renderTemplate(template, {
    name: body.name || 'there',
    interests: goalLabels.length > 0 ? goalLabels.join(', ') : 'your goals',
    aiContent,
    interestLinks: interestLines,
    waitlistPosition
  });

  return rendered
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

