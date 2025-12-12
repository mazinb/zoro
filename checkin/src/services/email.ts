import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY environment variable is required');
}

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendCheckInEmail(
  email: string,
  promptText: string,
  campaignId: string
) {
  // For localhost testing, we'll use Resend's test domain
  // In production (Phase 1), this will use your configured domain
  await resend.emails.send({
    from: 'Check-In System <onboarding@resend.dev>',
    to: email,
    reply_to: 'replies@inbound.yourdomain.com', // Will be configured in Phase 1
    subject: 'Your Weekly Check-In',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Weekly Check-In</h2>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          ${promptText}
        </div>
        <p>Simply reply to this email to submit your response.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          This is an automated check-in email. Reply to this message to submit your response.
        </p>
      </div>
    `,
    text: `${promptText}\n\nSimply reply to this email to submit your response.`
  });
}

