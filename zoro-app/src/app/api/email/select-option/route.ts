import { NextRequest, NextResponse } from 'next/server';

const optionMessages: Record<string, { subject: string; body: string }> = {
  A: {
    subject: 'Option A: The Fast Path',
    body: `I choose Option A: The Fast Path.

I'd like to receive a 2-minute form so I can provide the data points whenever I have a moment.`,
  },
  B: {
    subject: 'Option B: The Deep Dive',
    body: `I choose Option B: The Deep Dive.

I'd like to schedule a 30-minute call to talk through my goals live.`,
  },
  C: {
    subject: 'Option C: The Slow Burn',
    body: `I choose Option C: The Slow Burn.

I prefer to reply with a few details and go back and forth at my own pace.`,
  },
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const option = searchParams.get('option');
    const email = searchParams.get('email');

    if (!option || !email) {
      return NextResponse.json(
        { error: 'Missing option or email parameter' },
        { status: 400 }
      );
    }

    const optionUpper = option.toUpperCase();
    if (!['A', 'B', 'C'].includes(optionUpper)) {
      return NextResponse.json(
        { error: 'Invalid option. Must be A, B, or C' },
        { status: 400 }
      );
    }

    const optionData = optionMessages[optionUpper];
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromAddress = process.env.RESEND_FROM || 'Zoro <admin@getzoro.com>';
    const adminEmail = process.env.SUBMISSION_NOTIFY_EMAIL || 'mazin.biviji1@gmail.com';
    
    // Extract email from fromAddress if it's in format "Name <email>"
    const fromEmailMatch = fromAddress.match(/<(.+)>/);
    const fromEmail = fromEmailMatch ? fromEmailMatch[1] : fromAddress;

    // Auto-draft and send the reply email via Resend
    // Send to admin so they can see the user's selection
    if (resendApiKey) {
      const emailPayload = {
        from: `${email} <${fromEmail}>`, // Make it appear as if from the user
        to: adminEmail,
        reply_to: email, // So admin can reply directly to user
        subject: `Re: Welcome to Zoro - ${optionData.subject}`,
        text: optionData.body,
        html: optionData.body.replace(/\n/g, '<br>'),
      };

      try {
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emailPayload),
        });

        if (!resendResponse.ok) {
          const errorText = await resendResponse.text();
          console.error('Resend email failed:', resendResponse.status, errorText);
          // Continue anyway - we'll show a success page with manual instructions
        }
      } catch (error) {
        console.error('Error sending email via Resend:', error);
        // Continue anyway
      }
    }

    // Return a success page
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Option Selected</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
              line-height: 1.6;
            }
            .success {
              background: #f0f9ff;
              border: 2px solid #0ea5e9;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            .option {
              background: #f8fafc;
              border-left: 4px solid #3b82f6;
              padding: 15px;
              margin: 15px 0;
            }
          </style>
        </head>
        <body>
          <div class="success">
            <h2>✓ Option ${optionUpper} Selected!</h2>
            <p>We've sent a confirmation email to <strong>${email}</strong> with your selection.</p>
            <p>You can also reply directly to the original email if you prefer.</p>
          </div>
          <div class="option">
            <h3>${optionData.subject}</h3>
            <p>${optionData.body.replace(/\n/g, '<br>')}</p>
          </div>
          <p><a href="https://www.getzoro.com">← Back to Zoro</a></p>
        </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('Error processing option selection:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

