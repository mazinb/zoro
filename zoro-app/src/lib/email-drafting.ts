function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Canonical goal id for retirement is "retirement"; URL path is "/retire".
// Normalize so "retire" (from links/paths) is always treated as "retirement" everywhere.
export const GOAL_ID_RETIREMENT = 'retirement';
export const GOAL_PATH_RETIRE = '/retire';

const goalLabels: Record<string, string> = {
  save: 'Saving more consistently',
  invest: 'Investing smarter',
  home: 'Planning for big purchases',
  insurance: 'Reviewing insurance',
  tax: 'Optimizing taxes',
  [GOAL_ID_RETIREMENT]: 'Planning for retirement',
};

const goalPaths: Record<string, string> = {
  save: '/save',
  invest: '/invest',
  home: '/home',
  insurance: '/insurance',
  tax: '/tax',
  [GOAL_ID_RETIREMENT]: GOAL_PATH_RETIRE,
};

/** Normalize goal id: "retire" (path-style) -> "retirement" (canonical). */
function normalizeGoalId(goalId: string): string {
  if (goalId === 'retire') return GOAL_ID_RETIREMENT;
  return goalId;
}

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || 'https://www.getzoro.com';
}

function extractGoals(body: Record<string, any>): string[] {
  let raw: string[] = [];
  // Try to get goals from body.goals (array)
  if (Array.isArray(body.goals) && body.goals.length > 0) {
    raw = body.goals;
  } else if (body.additional_info) {
    try {
      const parsed = typeof body.additional_info === 'string'
        ? JSON.parse(body.additional_info)
        : body.additional_info;
      if (parsed?.goals && Array.isArray(parsed.goals)) {
        raw = parsed.goals;
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
  return raw.map(normalizeGoalId);
}

function formatGoalsList(goalIds: string[], userToken: string | null): { html: string; text: string } {
  if (goalIds.length === 0) {
    return { html: 'Financial planning', text: 'Financial planning' };
  }
  
  const baseUrl = getBaseUrl();
  const htmlParts: string[] = [];
  const textParts: string[] = [];
  
  goalIds.forEach((id) => {
    const canonicalId = normalizeGoalId(id);
    const goalName = goalLabels[canonicalId] || id;
    const path = goalPaths[canonicalId] || '';
    const hasValidToken = userToken && typeof userToken === 'string' && userToken.trim().length > 0;
    
    if (path && hasValidToken) {
      const url = `${baseUrl}${path}?token=${encodeURIComponent(userToken)}`;
      htmlParts.push(`<a href="${url}" style="color: #0066cc; text-decoration: underline;">${escapeHtml(goalName)}</a>`);
      textParts.push(`${goalName} - ${url}`);
    } else {
      htmlParts.push(escapeHtml(goalName));
      textParts.push(goalName);
    }
  });
  
  // Join with commas and "and" for the last item
  let html = '';
  let text = '';
  
  if (htmlParts.length === 1) {
    html = htmlParts[0];
    text = textParts[0];
  } else if (htmlParts.length === 2) {
    html = `${htmlParts[0]} and ${htmlParts[1]}`;
    text = `${textParts[0]} and ${textParts[1]}`;
  } else {
    html = htmlParts.slice(0, -1).join(', ') + ', and ' + htmlParts[htmlParts.length - 1];
    text = textParts.slice(0, -1).join(', ') + ', and ' + textParts[textParts.length - 1];
  }
  
  return { html, text };
}

export async function buildDraftResponseEmail(body: Record<string, any>) {
  const userName = body.name || 'there';
  const waitlistPosition = body.waitlistPosition ?? 0;
  const userToken = body.userToken || body.token || '';
  const baseUrl = getBaseUrl();
  const expensesUrl = userToken ? `${baseUrl}/expenses?token=${encodeURIComponent(userToken)}` : '';

  let textContent: string;

  if (waitlistPosition <= 10) {
    textContent = `Hi ${userName},

Thanks for sharing your goals!

You're #${waitlistPosition} on our waitlist. We are still building Zoro.

Simply reply to this email to interact with our agent. You can ask about your goals, general money questions, set up reminders, or how I work.

Start with expenses: ${expensesUrl || baseUrl + '/expenses'}

Thanks,
Zoro`;
  } else {
    textContent = `Thanks for sharing your goals!
You're #${waitlistPosition} on our waitlist. We are still building Zoro but want to give you a peak. There are 3 ways to interact:
1. Simply reply to this email. You can ask about your goals, general money questions or ask how I work. Anything really
2. Use action buttons like the one below share data or view your information. You are always in control of what I know
3. By scheduling one time or recurring reminders for me to follow up. I won't email you ever again unless you ask me to
Can't wait to work with you!
Zoro
Start with expenses: ${expensesUrl || baseUrl + '/expenses'}`;
  }

  const htmlContent = textContent
    .split('\n')
    .map((line) => {
      if (line.includes('Start with expenses:')) {
        const url = expensesUrl || baseUrl + '/expenses';
        return `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Start with expenses</a></p><p style="color:#64748b;font-size:14px">Or copy this link: ${escapeHtml(url)}</p>`;
      }
      return escapeHtml(line);
    })
    .join('<br>\n');

  return {
    text: textContent,
    html: htmlContent,
  };
}

