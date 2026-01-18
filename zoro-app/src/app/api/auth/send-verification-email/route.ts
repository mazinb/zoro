import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

// Send verification email
// This is a placeholder - in production, use a proper email service
// or Supabase Edge Function
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, token, name, goals, context, registrationNo } = body;

    if (!email || !token) {
      return NextResponse.json(
        { error: 'Email and token are required' },
        { status: 400 }
      );
    }

    // Create verification link
    const verificationLink = `${baseUrl}/login?email=${encodeURIComponent(email)}&token=${token}&mode=signup`;

    const isAdvisorContext = context === 'advisor';

    const emailSubject = isAdvisorContext
      ? 'Confirm your advisor workspace on Zoro'
      : 'Welcome to Zoro - Confirm your email';

    const emailBody = isAdvisorContext
      ? `
Hello ${name || 'advisor'},

We received a request to activate advisor access on Zoro for SEBI registration ${registrationNo || 'your firm'}.

Confirming your email lets you:
- Access your advisor workspace
- Receive client opt-in notifications
- Collaborate securely with shared check-ins

Finish verification here:

${verificationLink}

This link will expire in 24 hours. If you didn't request access, you can ignore this email.

The Zoro Team
      `.trim()
      : `
Hello ${name || 'there'},

Thank you for your interest in Zoro! We're excited to help you with your financial planning goals.

${goals && goals.length > 0 
  ? `Based on your selections, we see you're interested in: ${goals.join(', ')}.`
  : "We're here to help you achieve your financial goals."
}

To complete your registration and set up your password, please click the link below:

${verificationLink}

This link will expire in 24 hours.

If you didn't request this, please ignore this email.

Best regards,
The Zoro Team
    `.trim();

    console.log('Email to send:', {
      to: email,
      subject: emailSubject,
      body: emailBody,
      verificationLink
    });

    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const fromAddress = process.env.RESEND_FROM || 'Zoro <noreply@zoro.app>';
      await resend.emails.send({
        from: fromAddress,
        to: email,
        subject: emailSubject,
        html: emailBody.replace(/\n/g, '<br>'),
      });
    } else {
      console.warn('RESEND_API_KEY not set; skipping email send');
    }

    return NextResponse.json(
      { 
        success: true,
        message: 'Verification email sent',
        // In development, return the link for testing
        ...(process.env.NODE_ENV === 'development' && { verificationLink })
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error sending verification email:', error);
    return NextResponse.json(
      { error: 'Failed to send verification email' },
      { status: 500 }
    );
  }
}

