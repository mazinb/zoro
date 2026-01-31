function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const goalLabels: Record<string, string> = {
  save: 'Save more consistently',
  invest: 'Invest smarter',
  home: 'Plan for big purchases',
  insurance: 'Review insurance',
  tax: 'Tax optimization',
  retirement: 'Retirement planning',
};

const goalPaths: Record<string, string> = {
  save: '/save',
  invest: '/invest',
  home: '/home',
  insurance: '/insurance',
  tax: '/tax',
  retirement: '/retire',
};

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || 'https://www.getzoro.com';
}

function extractGoals(body: Record<string, any>): string[] {
  // Try to get goals from body.goals (array)
  if (Array.isArray(body.goals) && body.goals.length > 0) {
    return body.goals;
  }
  
  // Try to parse from additional_info if it's a JSON string
  if (body.additional_info) {
    try {
      const parsed = typeof body.additional_info === 'string' 
        ? JSON.parse(body.additional_info) 
        : body.additional_info;
      if (parsed?.goals && Array.isArray(parsed.goals)) {
        return parsed.goals;
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
  
  return [];
}

function formatGoalsList(goalIds: string[], userToken: string | null): { html: string; text: string } {
  if (goalIds.length === 0) {
    return { html: '<li>Financial planning</li>', text: 'Financial planning' };
  }
  
  const baseUrl = getBaseUrl();
  const html = goalIds.map(id => {
    const goalName = goalLabels[id] || id;
    const path = goalPaths[id] || '';
    if (path && userToken) {
      const url = `${baseUrl}${path}?token=${encodeURIComponent(userToken)}`;
      return `<li><a href="${url}" style="color: #3b82f6; text-decoration: underline;">${escapeHtml(goalName)}</a></li>`;
    }
    return `<li>${escapeHtml(goalName)}</li>`;
  }).join('\n');
  
  const text = goalIds.map((id, i) => {
    const goalName = goalLabels[id] || id;
    const path = goalPaths[id] || '';
    if (path && userToken) {
      const url = `${baseUrl}${path}?token=${encodeURIComponent(userToken)}`;
      return `${i + 1}. ${goalName} - ${url}`;
    }
    return `${i + 1}. ${goalName}`;
  }).join('\n');
  
  return { html, text };
}

export async function buildDraftResponseEmail(body: Record<string, any>) {
  const userName = body.name || 'there';
  const waitlistPosition = body.waitlistPosition || null;
  const userToken = body.userToken || null;
  
  // Extract goals
  const goalIds = extractGoals(body);
  const goalsList = formatGoalsList(goalIds, userToken);
  
  // Build waitlist text
  const waitlistText = waitlistPosition 
    ? `You're #${waitlistPosition} on our waitlist. `
    : '';

  const htmlContent = `
    <p>Hi ${escapeHtml(userName)},</p>
    <p>Thanks for sharing your goals with us! I see you're interested in:</p>
    <ul style="list-style: disc; padding-left: 24px; margin: 12px 0;">
      ${goalsList.html}
    </ul>
    <p>Using the links above to share more details before our call will help us make the most of our time together.</p>
    <p>Whenever you are ready, let's grab 15 minutes to talk through your goals. I will take the notes and send them to you.</p>
    <p style="margin: 20px 0;">
      <a href="https://calendly.com/mazinb/15min" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">Schedule Your 15-Minute Call</a>
    </p>
    <p>Feel free to share any documents by replying to this email or anything else that might be relevant. Will read it before we meet.</p>
    <p>${waitlistText}We're only offering onboarding calls for a limited time, so I'd love to connect soon.</p>
    <p>Thanks,<br>Zoro</p>
  `;

  const textContent = `Hi ${userName},

Thanks for sharing your goals with us! I see you're interested in:

${goalsList.text}

Using the links above to share more details before our call will help us make the most of our time together.

Whenever you are ready, let's grab 15 minutes to talk through your goals. I will take the notes and send them to you.

Schedule your call here: https://calendly.com/mazinb/15min

Feel free to share any documents by replying to this email or anything else that might be relevant. Will read it before we meet.

${waitlistText}We're only offering onboarding calls for a limited time, so I'd love to connect soon.

Thanks,
Zoro`;

  return {
    text: textContent,
    html: htmlContent.trim(),
  };
}

