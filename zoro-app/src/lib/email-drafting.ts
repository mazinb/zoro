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
    return { html: 'financial planning', text: 'financial planning' };
  }
  
  const baseUrl = getBaseUrl();
  // Use inline comma-separated links for better email client compatibility
  const htmlParts = goalIds.map((id, index) => {
    const goalName = goalLabels[id] || id;
    const path = goalPaths[id] || '';
    if (path && userToken) {
      const url = `${baseUrl}${path}?token=${encodeURIComponent(userToken)}`;
      return `<a href="${url}" style="color: #0066cc; text-decoration: underline;">${escapeHtml(goalName)}</a>`;
    }
    return escapeHtml(goalName);
  });
  
  // Join with commas and "and" for the last item
  let html = '';
  if (htmlParts.length === 1) {
    html = htmlParts[0];
  } else if (htmlParts.length === 2) {
    html = `${htmlParts[0]} and ${htmlParts[1]}`;
  } else {
    html = htmlParts.slice(0, -1).join(', ') + ', and ' + htmlParts[htmlParts.length - 1];
  }
  
  const textParts = goalIds.map((id, i) => {
    const goalName = goalLabels[id] || id;
    const path = goalPaths[id] || '';
    if (path && userToken) {
      const url = `${baseUrl}${path}?token=${encodeURIComponent(userToken)}`;
      return `${goalName} (${url})`;
    }
    return goalName;
  });
  
  let text = '';
  if (textParts.length === 1) {
    text = textParts[0];
  } else if (textParts.length === 2) {
    text = `${textParts[0]} and ${textParts[1]}`;
  } else {
    text = textParts.slice(0, -1).join(', ') + ', and ' + textParts[textParts.length - 1];
  }
  
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
      <p style="color: #000000; margin: 0 0 12px 0;">Thanks for sharing your goals with us! I see you're interested in ${goalsList.html}.</p>
      <p style="color: #000000; margin: 0 0 12px 0;">Use the links above to share more details before our call. Once you are ready, let us talk through your goals. I will take the notes and send them to you.</p>
      <p style="color: #000000; margin: 0 0 12px 0;">Schedule your call here: <a href="https://calendly.com/mazinb/15min" style="color: #0066cc; text-decoration: underline;">https://calendly.com/mazinb/15min</a></p>
      <p style="color: #000000; margin: 0 0 12px 0;">Share any documents, links or anything else that might be relevant by replying to this email. Will read it before we meet.</p>
      <p style="color: #000000; margin: 0 0 12px 0;">${waitlistText}We're only offering onboarding calls for a limited time, so I'd love to connect soon.</p>
      <p style="color: #000000; margin: 0;">Thanks,<br>Zoro</p>
    </div>
  `;

  const textContent = `Hi ${userName},

Thanks for sharing your goals with us! I see you're interested in ${goalsList.text}.

Use the links above to share more details before our call. Once you are ready, let us talk through your goals. I will take the notes and send them to you.

Schedule your call here: https://calendly.com/mazinb/15min

Share any documents, links or anything else that might be relevant by replying to this email. Will read it before we meet.

${waitlistText}We're only offering onboarding calls for a limited time, so I'd love to connect soon.

Thanks,
Zoro`;

  return {
    text: textContent,
    html: htmlContent.trim(),
  };
}

