import { Request } from 'express';
import { supabase } from '../services/supabase';
import { verifyWebhookSignature } from '../services/webhook-verification';
import { stripEmailContent } from '../services/email-parser';

interface ResendWebhookPayload {
  type: string;
  data: {
    from: string;
    to: string[];
    subject: string;
    text?: string;
    html?: string;
    headers?: Record<string, string>;
    // ... other fields
  };
}

export async function handleInboundEmail(req: Request) {
  // Verify webhook signature
  const signature = req.headers['svix-signature'] as string;
  const timestamp = req.headers['svix-timestamp'] as string;
  const webhookId = req.headers['svix-id'] as string;
  
  // For localhost testing, we might skip signature verification if WEBHOOK_SECRET is not set
  // In production, this should always be verified
  if (process.env.WEBHOOK_SECRET) {
    if (!signature || !timestamp) {
      throw new Error('Missing webhook signature headers');
    }
    
    const payload = JSON.stringify(req.body);
    const isValid = verifyWebhookSignature(
      payload,
      signature,
      timestamp,
      process.env.WEBHOOK_SECRET
    );
    
    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }
  } else {
    console.warn('WEBHOOK_SECRET not set - skipping signature verification (not recommended for production)');
  }
  
  const webhookData: ResendWebhookPayload = req.body;
  
  // Only process email.received events
  if (webhookData.type !== 'email.received') {
    console.log(`Ignoring webhook type: ${webhookData.type}`);
    return;
  }
  
  const { from, to, text, html, subject } = webhookData.data;
  
  // Extract sender email
  const senderEmail = extractEmail(from);
  
  // Find user by email
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', senderEmail)
    .eq('is_verified', true)
    .single();
  
  if (userError || !user) {
    console.log(`No verified user found for email: ${senderEmail}`);
    throw new Error('User not found or not verified');
  }
  
  // Extract email content (prefer text over html)
  const rawContent = text || html || '';
  const strippedContent = stripEmailContent(rawContent);
  
  // Determine campaign_id if possible (from subject or headers)
  // For now, we'll get the most recent active campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  // Store reply
  const { data: reply, error: replyError } = await supabase
    .from('replies')
    .insert({
      user_id: user.id,
      campaign_id: campaign?.id || null,
      email_content_raw: rawContent,
      email_content_stripped: strippedContent,
      received_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (replyError) {
    throw replyError;
  }
  
  console.log(`Reply stored for user ${user.id}, reply ID: ${reply.id}`);
  
  // Optional: Send confirmation email
  // await sendReplyConfirmation(senderEmail);
  
  return reply;
}

function extractEmail(emailString: string): string {
  // Handle formats like "Name <email@domain.com>" or just "email@domain.com"
  const match = emailString.match(/<(.+)>/) || [null, emailString];
  return match[1].trim();
}

