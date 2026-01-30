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

function formatGoalsList(goalIds: string[]): { html: string; text: string } {
  if (goalIds.length === 0) {
    return { html: '<li>Financial planning</li>', text: 'Financial planning' };
  }
  
  const goalNames = goalIds.map(id => goalLabels[id] || id);
  const html = goalNames.map(goal => `<li>${escapeHtml(goal)}</li>`).join('\n');
  const text = goalNames.map((goal, i) => `${i + 1}. ${goal}`).join('\n');
  
  return { html, text };
}

export async function buildDraftResponseEmail(body: Record<string, any>) {
  const userName = body.name || 'there';
  const waitlistPosition = body.waitlistPosition || null;
  
  // Extract goals
  const goalIds = extractGoals(body);
  const goalsList = formatGoalsList(goalIds);
  
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
    <p>Let's grab 15 minutes to talk through your goals. I'll take the notes so you don't have to.</p>
    <p style="margin: 20px 0;">
      <a href="https://calendly.com/mazinb/15min" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">Schedule Your 15-Minute Call</a>
    </p>
    <p>Feel free to share anything relevant to your goals before our call. It'll help us make the most of our time together.</p>
    <p>${waitlistText}We're only offering onboarding calls for a limited time, so I'd love to connect soon.</p>
    <p>Thanks,<br>Zoro</p>
  `;

  const textContent = `Hi ${userName},

Thanks for sharing your goals with us! I see you're interested in:

${goalsList.text}

Let's grab 15 minutes to talk through your goals. I'll take the notes so you don't have to.

Schedule your call here: https://calendly.com/mazinb/15min

Feel free to share anything relevant to your goals before our call. It'll help us make the most of our time together.

${waitlistText}We're only offering onboarding calls for a limited time, so I'd love to connect soon.

Thanks,
Zoro`;

  return {
    text: textContent,
    html: htmlContent.trim(),
  };
}

