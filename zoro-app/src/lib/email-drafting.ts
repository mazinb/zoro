function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const goalLabels: Record<string, string> = {
  save: 'Saving more consistently',
  invest: 'Investing smarter',
  home: 'Planning for big purchases',
  insurance: 'Reviewing insurance',
  tax: 'Optimizing taxes',
  retirement: 'Planning for retirement',
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
    // Check if we have both path and a valid (non-empty) token
    const hasValidToken = userToken && typeof userToken === 'string' && userToken.trim().length > 0;
    console.log(`Formatting goal ${id}: path="${path}", userToken=${hasValidToken ? `exists (${userToken.substring(0, 8)}...)` : 'missing/invalid'}`);
    if (path && hasValidToken) {
      const url = `${baseUrl}${path}?token=${encodeURIComponent(userToken)}`;
      return `<li><a href="${url}" style="color: #0066cc; text-decoration: underline;">${escapeHtml(goalName)}</a></li>`;
    }
    console.log(`Skipping link for ${id} - path: ${path ? 'yes' : 'no'}, token: ${hasValidToken ? 'yes' : 'no'}`);
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
    <div style="color: #000000; font-family: Arial, sans-serif; line-height: 1.6;">
      <p style="color: #000000; margin: 0 0 12px 0;">Hi ${escapeHtml(userName)},</p>
      <p style="color: #000000; margin: 0 0 12px 0;">Thanks for sharing your goals with us! I see you're interested in:</p>
      <ul style="color: #000000; margin: 0 0 12px 0; padding-left: 24px;">
        ${goalsList.html}
      </ul>
      <p style="color: #000000; margin: 0 0 12px 0;">Using the links above to share more details before our call will help us make the most of our time together.</p>
      <p style="color: #000000; margin: 0 0 12px 0;">Whenever you are ready, let's grab 15 minutes to talk through your goals. I will take the notes and send them to you.</p>
      <p style="color: #000000; margin: 0 0 12px 0;">Schedule your call here: <a href="https://calendly.com/mazinb/15min" style="color: #0066cc; text-decoration: underline;">https://calendly.com/mazinb/15min</a></p>
      <p style="color: #000000; margin: 0 0 12px 0;">Feel free to share any documents by replying to this email or anything else that might be relevant. Will read it before we meet.</p>
      <p style="color: #000000; margin: 0 0 12px 0;">${waitlistText}We're only offering onboarding calls for a limited time, so I'd love to connect soon.</p>
      <p style="color: #000000; margin: 0;">Thanks,<br>Zoro</p>
    </div>
  `;

  const textContent = `Hi ${userName},

Thanks for sharing your goals with us! I see you're interested in: ${goalsList.text}.

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

