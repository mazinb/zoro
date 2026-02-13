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
    return { html: 'Financial planning', text: 'Financial planning' };
  }
  
  const baseUrl = getBaseUrl();
  const htmlParts: string[] = [];
  const textParts: string[] = [];
  
  goalIds.forEach((id, index) => {
    const goalName = goalLabels[id] || id;
    const path = goalPaths[id] || '';
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

const ONBOARDING_MEETING_LINK = 'https://calendly.com/mazinb/15min';

export async function buildDraftResponseEmail(body: Record<string, any>) {
  const userName = body.name || 'there';
  const waitlistPosition = body.waitlistPosition ?? 0;

  let textContent: string;

  if (waitlistPosition <= 10) {
    // First 10 users get the full message with link
    textContent = `Hi ${userName},

Thanks for sharing your goals!

You're #${waitlistPosition} on our waitlist. We are still building Zoro.

While we do, I'd be happy to schedule a 15 min call to get you set up and schedule customized follow ups to make sure you stay on track.

Or simply reply to this email to interact with our agent.

Thanks,
Zoro

${ONBOARDING_MEETING_LINK}`;
  } else {
    // Users #11+ get simplified message without link
    textContent = `Thanks for sharing your goals!
You're #${waitlistPosition} on our waitlist. We are still building Zoro but want to give you a peak.
Simply reply to this email to interact with our agent.
— Zoro`;
  }

  // Plain text only: html is same content with newlines as <br> for display
  const htmlContent = textContent
    .split('\n')
    .map((line) => escapeHtml(line))
    .join('<br>\n');

  return {
    text: textContent,
    html: htmlContent,
  };
}

