import { NextRequest, NextResponse } from 'next/server';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

// Send verification email
// This is a placeholder - in production, use a proper email service
// or Supabase Edge Function
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, token, name, goals } = body;

    if (!email || !token) {
      return NextResponse.json(
        { error: 'Email and token are required' },
        { status: 400 }
      );
    }

    // Create verification link
    const verificationLink = `${baseUrl}/login?email=${encodeURIComponent(email)}&token=${token}&mode=signup`;

    // Email content
    const emailSubject = 'Welcome to Zoro - Confirm your email';
    const emailBody = `
Hello ${name || 'there'},

Thank you for your interest in Zoro! We're excited to help you with your financial planning goals.

${goals && goals.length > 0 
  ? `Based on your selections, we see you're interested in: ${goals.join(', ')}.`
  : 'We\'re here to help you achieve your financial goals.'
}

To complete your registration and set up your password, please click the link below:

${verificationLink}

This link will expire in 24 hours.

If you didn't request this, please ignore this email.

Best regards,
The Zoro Team
    `.trim();

    // TODO: Send email using your email service
    // For now, we'll just log it and return success
    // In production, integrate with:
    // - Resend (recommended)
    // - SendGrid
    // - AWS SES
    // - Or Supabase Edge Function with a service like Resend

    console.log('Email to send:', {
      to: email,
      subject: emailSubject,
      body: emailBody,
      verificationLink
    });

    // For development, you can use a service like Resend
    // Example with Resend (uncomment and add RESEND_API_KEY to .env):
    /*
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'Zoro <noreply@yourdomain.com>',
        to: email,
        subject: emailSubject,
        html: emailBody.replace(/\n/g, '<br>'),
      });
    }
    */

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

