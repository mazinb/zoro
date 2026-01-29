import { loadEmailTemplate, renderTemplate } from '@/lib/email-templates';

type AiDraftResult = {
  draft: string;
  focusGoalId: string | null;
};

const goalLabelById: Record<string, string> = {
  save: 'Save more consistently',
  invest: 'Invest smarter',
  home: 'Plan for big purchases',
  insurance: 'Review insurance',
  tax: 'Tax optimization',
  retirement: 'Retirement planning'
};

const goalLinkById: Record<string, { label: string; path: string }> = {
  save: { label: 'Save more consistently', path: '/save' },
  invest: { label: 'Invest smarter', path: '/invest' },
  home: { label: 'Plan for big purchases', path: '/home' },
  insurance: { label: 'Review insurance', path: '/insurance' },
  tax: { label: 'Tax optimization', path: '/tax' },
  retirement: { label: 'Retirement planning', path: '/retire' },
};

const documentRequestsByGoalId: Record<string, string[]> = {
  save: [
    'Recent bank statements (last 3 months)',
    'Monthly expense breakdown or budget',
    'Outstanding debt details (if any)',
  ],
  invest: [
    'Current investment statements or holdings',
    'Asset allocation snapshot (if available)',
    'Any risk profile or investment policy notes',
  ],
  home: [
    'Target purchase estimate or budget',
    'Savings balance earmarked for the purchase',
    'Existing loan obligations or pre-approval details',
  ],
  insurance: [
    'Existing insurance policy documents',
    'Coverage amounts and premium details',
    'Riders or add-ons you currently have',
  ],
  tax: [
    'Most recent Form 16 / ITR',
    'Investment proof summaries',
    'Capital gains or interest statements',
  ],
  retirement: [
    'Retirement account statements',
    'Current savings and contribution amounts',
    'Any pension or employer benefit details',
  ],
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
  return { goalIds };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildAiContext(body: Record<string, any>, goalIds: string[]) {
  const selectedGoals =
    goalIds.length > 0 ? goalIds.map((id) => goalLabelById[id] || id).join(', ') : 'none';
  const rawSubmission = JSON.stringify(body, null, 2);

  return [
    'Selected goals:',
    selectedGoals,
    '',
    'Raw form submission (include any free text input exactly as provided):',
    rawSubmission,
  ].join('\n');
}

function extractJsonObject(value: string) {
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return value.slice(start, end + 1);
}

function normalizeFocusGoalId(value: string | null | undefined, goalIds: string[]) {
  const cleaned = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (cleaned && goalLabelById[cleaned]) return cleaned;
  const fallback = goalIds.find((goalId) => goalLabelById[goalId]);
  return fallback || 'retirement';
}

async function generateAiContent(body: Record<string, any>, goalIds: string[]): Promise<AiDraftResult & { insights?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('OpenAI draft skipped: OPENAI_API_KEY not set');
    return { draft: fallbackAiContent, focusGoalId: normalizeFocusGoalId('', goalIds), insights: undefined };
  }

  try {
    const context = buildAiContext(body, goalIds);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.6,
        max_tokens: 400,
        messages: [
          {
            role: 'system',
            content:
              [
                'You draft personalized, warm, professional onboarding email content for a financial planning service.',
                'Focus on India-based planning for NRIs and Indian residents.',
                'Return ONLY valid JSON with keys: draft, focusGoalId, insights.',
                'draft: 2-3 short paragraphs welcoming them, acknowledging their goals, and setting expectations. No greeting, no sign-off, no bullet lists unless specifically requested.',
                `focusGoalId: pick ONE primary goal from ${Object.keys(goalLabelById).join(', ')} based on their submission.`,
                'insights: Optional 1-2 sentence personalized insight or observation based on their submission. Can be empty string if no meaningful insight. Keep it brief and relevant.'
              ].join(' ')
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
      return { draft: fallbackAiContent, focusGoalId: normalizeFocusGoalId('', goalIds) };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim() || '';
    const jsonBlock = extractJsonObject(content);
    if (!jsonBlock) {
      return { draft: fallbackAiContent, focusGoalId: normalizeFocusGoalId('', goalIds), insights: undefined };
    }
    const parsed = JSON.parse(jsonBlock) as { draft?: string; focusGoalId?: string; insights?: string };
    const draft = parsed?.draft?.trim() || fallbackAiContent;
    const focusGoalId = normalizeFocusGoalId(parsed?.focusGoalId, goalIds);
    const insights = parsed?.insights?.trim() || undefined;
    return { draft, focusGoalId, insights };
  } catch (error) {
    console.error('OpenAI draft generation failed:', error);
    return { draft: fallbackAiContent, focusGoalId: normalizeFocusGoalId('', goalIds), insights: undefined };
  }
}

function buildFocusGoalLink(goalId: string, baseUrl: string) {
  const link = goalLinkById[goalId] || goalLinkById.retirement;
  return {
    label: link.label,
    url: `${baseUrl}${link.path}`,
  };
}

function buildDocumentRequests(goalIds: string[]) {
  const requests = goalIds.flatMap((goalId) => documentRequestsByGoalId[goalId] || []);
  const fallback = [
    'Recent bank statements (last 3 months)',
    'Current investment or retirement statements (if applicable)',
    'Any existing insurance policy documents',
  ];
  const combined = requests.length > 0 ? requests : fallback;
  return Array.from(new Set(combined));
}

function formatAiHtml(content: string) {
  return escapeHtml(content).replace(/\n/g, '<br>');
}

export async function buildDraftResponseEmail(body: Record<string, any>) {
  const { goalIds } = normalizeInterests(body);
  const baseUrl = getBaseUrl();
  const { draft, focusGoalId, insights } = await generateAiContent(body, goalIds);
  const focusGoalLink = buildFocusGoalLink(focusGoalId || 'retirement', baseUrl);
  const documentRequests = buildDocumentRequests(goalIds);
  const template = await loadEmailTemplate('welcome-reply');
  const waitlistPosition =
    body.waitlistPosition !== null && body.waitlistPosition !== undefined
      ? String(body.waitlistPosition)
      : 'TBD';
  const waitlistNumber =
    typeof body.waitlistPosition === 'number' ? body.waitlistPosition : Number(waitlistPosition);
  
  // Explain why they got a call (only top 10)
  const waitlistExplanation = Number.isFinite(waitlistNumber) && waitlistNumber <= 10
    ? `Great news! You're in our top 10, which means we'd love to schedule a quick intro call to better understand your needs and tailor a plan specifically for you.`
    : `We're excited to have you on board! As we work through the waitlist, we'll be in touch soon. In the meantime, please fill out the form below and share any relevant documents so we can get started on your personalized plan.`;
  
  const scheduleCallUrl = 'https://calendly.com/getzoro/intro';
  const scheduleLine =
    Number.isFinite(waitlistNumber) && waitlistNumber <= 10
      ? `<br>3. <u>Schedule a call</u><br><a href="${scheduleCallUrl}">Book a quick intro call</a>`
      : '';
  
  const insightsSection = insights
    ? `<strong>Quick insight:</strong><br>${formatAiHtml(insights)}`
    : '';
  
  const documentRequestHtml = documentRequests
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
  const rendered = renderTemplate(template, {
    name: body.name || 'there',
    aiContent: formatAiHtml(draft),
    documentRequests: documentRequestHtml,
    focusGoalLink: `<a href="${focusGoalLink.url}">Start with ${escapeHtml(
      focusGoalLink.label
    )}</a>`,
    scheduleLine,
    waitlistPosition,
    waitlistExplanation: formatAiHtml(waitlistExplanation),
    insightsSection,
  });

  const textLines = [
    `Hi ${body.name || 'there'},`,
    '',
    `Your waitlist position: #${waitlistPosition}`,
    '',
    waitlistExplanation,
    '',
    draft,
  ];
  
  if (insights) {
    textLines.push('', `Quick insight:`, insights);
  }
  
  textLines.push(
    '',
    'Next steps:',
    '',
    '1. Fill out the form:',
    `Start with ${focusGoalLink.label}: ${focusGoalLink.url}`,
    '',
    '2. Share documents:',
    ...documentRequests.map((item) => `- ${item}`),
  );
  
  if (Number.isFinite(waitlistNumber) && waitlistNumber <= 10) {
    textLines.push('', '3. Schedule a call:', scheduleCallUrl);
  }
  
  textLines.push(
    '',
    'Simply reply to this email with your answers. The more detail you share, the better we can tailor your plan.',
    '',
    "You can also attach documents or tell us if you prefer bullet points and we'll keep your preferences in mind.",
    '',
    'Thanks,',
    'Mazin'
  );

  return {
    text: textLines.join('\n'),
    html: rendered.replace(/\n{3,}/g, '\n\n').trim(),
    focusGoalId: focusGoalId || null,
  };
}

