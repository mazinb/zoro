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

async function generateFriendlyMessage(goalIds: string[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Fallback message if no API key
    return "Sharing a bit about your priorities before our call will help us make the most of our time together.";
  }

  try {
    const goalNames = goalIds.length > 0 
      ? goalIds.map(id => goalLabels[id] || id).join(', ')
      : 'your financial goals';
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 100,
        messages: [
          {
            role: 'system',
            content: 'You write friendly, warm, conversational messages for financial planning emails. Write exactly 1-2 sentences that are encouraging and personal. The message should mention that sharing details will make the call more productive. Do NOT include greetings, sign-offs, or quotation marks. Write as if speaking directly to the person.'
          },
          {
            role: 'user',
            content: `The user has selected these financial goals: ${goalNames}. Write a friendly 1-2 sentence message encouraging them to share details about these goals before our 15-minute call. Mention that sharing this information will make our conversation more productive and help us make the most of our time together.`
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI request failed: ${response.status}`);
    }

    const data = await response.json();
    const message = data?.choices?.[0]?.message?.content?.trim() || '';
    
    // Clean up any quotes or extra formatting
    const cleanedMessage = message.replace(/^["']|["']$/g, '').trim();
    
    return cleanedMessage || "Sharing a bit about your priorities before our call will help us make the most of our time together.";
  } catch (error) {
    console.error('Failed to generate AI message:', error);
    return "Sharing a bit about your priorities before our call will help us make the most of our time together.";
  }
}

export async function buildDraftResponseEmail(body: Record<string, any>) {
  const userName = body.name || 'there';
  const waitlistPosition = body.waitlistPosition || null;
  
  // Extract goals
  const goalIds = extractGoals(body);
  const goalsList = formatGoalsList(goalIds);
  
  // Generate friendly AI message
  const friendlyMessage = await generateFriendlyMessage(goalIds);
  
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
    <p>${escapeHtml(friendlyMessage)}</p>
    <p>Let's grab 15 minutes to talk through your goals—I'll take the notes so you don't have to.</p>
    <p style="margin: 20px 0;">
      <a href="https://calendly.com/mazinb/15min" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">Schedule Your 15-Minute Call</a>
    </p>
    <p>Feel free to share anything relevant to your goals before our call—it'll help us make the most of our time together.</p>
    <p>${waitlistText}We're only offering onboarding calls for a limited time, so I'd love to connect soon.</p>
    <p>Thanks,<br>Zoro</p>
  `;

  const textContent = `Hi ${userName},

Thanks for sharing your goals with us! I see you're interested in:

${goalsList.text}

${friendlyMessage}

Let's grab 15 minutes to talk through your goals—I'll take the notes so you don't have to.

Schedule your call here: https://calendly.com/mazinb/15min

Feel free to share anything relevant to your goals before our call—it'll help us make the most of our time together.

${waitlistText}We're only offering onboarding calls for a limited time, so I'd love to connect soon.

Thanks,
Zoro`;

  return {
    text: textContent,
    html: htmlContent.trim(),
  };
}

