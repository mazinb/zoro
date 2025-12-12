import { Resend } from 'resend';
import crypto from 'crypto';
import { supabase } from './supabase';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY environment variable is required');
}

const resend = new Resend(process.env.RESEND_API_KEY);

export async function registerUser(email: string, checkinFrequency: string = 'weekly') {
  // Generate secure token
  const verificationToken = crypto.randomBytes(32).toString('base64url');
  
  // Calculate next check-in date based on frequency
  const nextCheckinDue = calculateNextCheckinDate(checkinFrequency);
  
  // Insert user into database
  const { data: user, error } = await supabase
    .from('users')
    .insert({
      email,
      verification_token: verificationToken,
      checkin_frequency: checkinFrequency,
      next_checkin_due: nextCheckinDue.toISOString(),
      is_verified: false
    })
    .select()
    .single();
  
  if (error) throw error;
  
  // Send verification email
  await sendVerificationEmail(email, verificationToken);
  
  return user;
}

async function sendVerificationEmail(email: string, token: string) {
  const baseUrl = process.env.VERIFICATION_BASE_URL || 'http://localhost:3000';
  const verificationUrl = `${baseUrl}/api/verify?token=${token}`;
  
  await resend.emails.send({
    from: 'Check-In System <onboarding@resend.dev>', // Using Resend test domain for localhost
    to: email,
    subject: 'Verify Your Email Address',
    html: `
      <h2>Welcome to Weekly Check-Ins!</h2>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href="${verificationUrl}">Verify Email</a></p>
      <p>Or copy and paste this URL into your browser:</p>
      <p>${verificationUrl}</p>
    `,
    text: `Welcome to Weekly Check-Ins!\n\nPlease verify your email address by visiting:\n${verificationUrl}`
  });
}

export function calculateNextCheckinDate(frequency: string): Date {
  const now = new Date();
  switch (frequency) {
    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'biweekly':
      return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    case 'monthly':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
}

