function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function buildDraftResponseEmail(body: Record<string, any>) {
  const userName = body.name || 'there';
  
  // Use the sender email (from the "from" field of the email) for mailto links
  // This makes it appear as a reply to the email the user received
  const senderEmail = body.senderEmail || 'admin@getzoro.com';
  
  // Create mailto links for each option - these will open as replies with the subject pre-filled
  const optionAMailto = `mailto:${senderEmail}?subject=Option A - Send me the form`;
  const optionBMailto = `mailto:${senderEmail}?subject=Option B - Let's schedule a call`;
  const optionCMailto = `mailto:${senderEmail}?subject=Option C - Let's go back and forth`;

  const htmlContent = `
    <p>Hi ${escapeHtml(userName)},</p>
    <p>Thanks for sharing a bit about your goals. I'd love to learn more about your priorities, timeline, and any current financial routines so we can tailor a plan that fits you.</p>
    <p>How would you prefer to dive in? Just reply with A, B, or C:</p>
    <ul style="list-style: none; padding-left: 0; line-height: 1.8; margin: 20px 0;">
      <li style="margin-bottom: 24px;">
        <a href="${optionAMailto}" style="color: #1e40af; text-decoration: none; font-weight: 500;">A. The Fast Path:</a> I'll send a 2-minute form so you can give me the data points whenever you have a moment.
      </li>
      <li style="margin-bottom: 24px;">
        <a href="${optionBMailto}" style="color: #1e40af; text-decoration: none; font-weight: 500;">B. The Deep Dive:</a> Let's grab 30 minutes to talk through your goals live—I'll take the notes so you don't have to.
      </li>
      <li style="margin-bottom: 24px;">
        <a href="${optionCMailto}" style="color: #1e40af; text-decoration: none; font-weight: 500;">C. The Slow Burn:</a> Just reply to this email with a few details, and we can go back and forth at your pace.
      </li>
    </ul>
    <p>Thanks,<br>Zoro</p>
  `;

  const textContent = `Hi ${userName},

Thanks for sharing a bit about your goals. I'd love to learn more about your priorities, timeline, and any current financial routines so we can tailor a plan that fits you.

How would you prefer to dive in? Just reply with A, B, or C:

A. The Fast Path: I'll send a 2-minute form so you can give me the data points whenever you have a moment.

B. The Deep Dive: Let's grab 30 minutes to talk through your goals live—I'll take the notes so you don't have to.

C. The Slow Burn: Just reply to this email with a few details, and we can go back and forth at your pace.

Thanks,
Zoro`;

  return {
    text: textContent,
    html: htmlContent.trim(),
  };
}

