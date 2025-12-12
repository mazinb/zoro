# Weekly Check-In System - Implementation Plan

## Overview
This document outlines the implementation plan for a weekly check-in system using Resend API and Node.js, focusing on **Phases 2, 3, and 4**. Phases 1 and 5 will be implemented later.

---

## Phase 2: Database Schema

### Database: Supabase (PostgreSQL)

We'll create three core tables to handle the check-in system logic.

### 2.1 Users Table

**Purpose**: Store user information, verification status, and check-in scheduling.

**Schema**:
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_token TEXT,
  checkin_frequency TEXT DEFAULT 'weekly', -- Options: 'daily', 'weekly', 'biweekly', 'monthly'
  next_checkin_due TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast verification token lookups
CREATE INDEX idx_users_verification_token ON users(verification_token) WHERE verification_token IS NOT NULL;

-- Index for scheduler queries
CREATE INDEX idx_users_checkin_due ON users(is_verified, next_checkin_due) WHERE is_verified = TRUE;
```

**Fields**:
- `id`: Primary key (UUID)
- `email`: User's email address (unique, indexed)
- `is_verified`: Boolean flag indicating email verification status
- `verification_token`: Cryptographically secure token for email verification (indexed, nullable)
- `checkin_frequency`: Frequency preference (string: 'daily', 'weekly', 'biweekly', 'monthly')
- `next_checkin_due`: Timestamp for next scheduled check-in
- `created_at`: Record creation timestamp
- `updated_at`: Record last update timestamp

### 2.2 Campaigns/Prompts Table

**Purpose**: Store email templates/prompts for check-in emails.

**Schema**:
```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Fields**:
- `id`: Primary key (UUID)
- `name`: Human-readable name for the campaign
- `prompt_text`: The content/body of the check-in email
- `is_active`: Whether this campaign is currently active
- `created_at`: Record creation timestamp
- `updated_at`: Record last update timestamp

### 2.3 Replies/Journal Table

**Purpose**: Store user replies to check-in emails.

**Schema**:
```sql
CREATE TABLE replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  email_content_raw TEXT NOT NULL,
  email_content_stripped TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user reply lookups
CREATE INDEX idx_replies_user_id ON replies(user_id);
CREATE INDEX idx_replies_received_at ON replies(received_at DESC);
```

**Fields**:
- `id`: Primary key (UUID)
- `user_id`: Foreign key to users table
- `campaign_id`: Optional foreign key to campaigns table (to track which prompt was answered)
- `email_content_raw`: Full email body as received
- `email_content_stripped`: Cleaned text with signatures and quoted text removed
- `received_at`: Timestamp when the reply was received
- `processed_at`: Timestamp when the reply was processed (for Phase 5)
- `created_at`: Record creation timestamp

### 2.4 Row Level Security (RLS) Policies

**Users Table**:
- Users can only read/update their own records (if needed for API)
- Service role has full access

**Campaigns Table**:
- Public read access for active campaigns
- Service role has full access

**Replies Table**:
- Users can only read their own replies (if needed for API)
- Service role has full access

---

## Phase 3: Outbound Logic (Verification & Check-ins)

### 3.1 Project Setup

**Dependencies**:
```json
{
  "dependencies": {
    "resend": "^3.0.0",
    "@supabase/supabase-js": "^2.78.0",
    "express": "^4.18.2",
    "node-cron": "^3.0.3",
    "crypto": "built-in",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/express": "^4.17.21",
    "@types/node-cron": "^3.0.11",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.2"
  }
}
```

**Environment Variables** (`.env`):
```
RESEND_API_KEY=re_xxxxxxxxx
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
VERIFICATION_BASE_URL=http://localhost:3000
WEBHOOK_SECRET=your-webhook-signing-secret
PORT=3000
```

**Note**: 
- Using `SUPABASE_ANON_KEY` instead of service role key for localhost testing
- `VERIFICATION_BASE_URL` is set to `http://localhost:3000` for local testing
- Domain setup (Phase 1) will be configured later for production

### 3.2 Verification Flow

#### 3.2.1 User Registration Endpoint

**Endpoint**: `POST /api/users/register`

**Functionality**:
1. Accept user email and checkin_frequency
2. Generate cryptographically secure verification token (32 bytes, base64 encoded)
3. Store user record in database with `is_verified = false`
4. Send verification email via Resend
5. Return success response

**Implementation**:
```typescript
// src/services/verification.ts
import { Resend } from 'resend';
import crypto from 'crypto';
import { supabase } from './supabase';

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
      next_checkin_due: nextCheckinDue,
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
  const verificationUrl = `${process.env.VERIFICATION_BASE_URL}/verify?token=${token}`;
  
  await resend.emails.send({
    from: 'Check-In System <noreply@yourdomain.com>',
    to: email,
    subject: 'Verify Your Email Address',
    html: `
      <h2>Welcome to Weekly Check-Ins!</h2>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href="${verificationUrl}">Verify Email</a></p>
      <p>Or copy and paste this URL into your browser:</p>
      <p>${verificationUrl}</p>
    `
  });
}

function calculateNextCheckinDate(frequency: string): Date {
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
```

#### 3.2.2 Verification Endpoint

**Endpoint**: `GET /api/verify`

**Functionality**:
1. Extract token from query parameters
2. Look up user by verification_token
3. If found and not already verified:
   - Set `is_verified = true`
   - Clear `verification_token` (set to NULL)
4. Return success/error response

**Implementation**:
```typescript
// src/routes/verify.ts
import { supabase } from '../services/supabase';

export async function verifyEmail(token: string) {
  // Find user by token
  const { data: user, error: findError } = await supabase
    .from('users')
    .select('id, is_verified')
    .eq('verification_token', token)
    .single();
  
  if (findError || !user) {
    throw new Error('Invalid or expired verification token');
  }
  
  if (user.is_verified) {
    return { message: 'Email already verified' };
  }
  
  // Update user
  const { error: updateError } = await supabase
    .from('users')
    .update({
      is_verified: true,
      verification_token: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id);
  
  if (updateError) throw updateError;
  
  return { message: 'Email verified successfully' };
}
```

### 3.3 Scheduler (Cron Job)

#### 3.3.1 Check-In Scheduler

**Purpose**: Periodically check for users due for check-ins and send emails.

**Schedule**: Run every hour (configurable)

**Implementation**:
```typescript
// src/services/scheduler.ts
import cron from 'node-cron';
import { supabase } from './supabase';
import { sendCheckInEmail } from './email';

export function startScheduler() {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log('Running check-in scheduler...');
    await processCheckIns();
  });
  
  console.log('Check-in scheduler started');
}

async function processCheckIns() {
  const now = new Date().toISOString();
  
  // Find users who are verified and due for check-in
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, checkin_frequency')
    .eq('is_verified', true)
    .lte('next_checkin_due', now);
  
  if (error) {
    console.error('Error fetching users:', error);
    return;
  }
  
  if (!users || users.length === 0) {
    console.log('No users due for check-in');
    return;
  }
  
  console.log(`Found ${users.length} users due for check-in`);
  
  // Get active campaign/prompt
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, prompt_text')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (!campaign) {
    console.error('No active campaign found');
    return;
  }
  
  // Send check-in emails
  for (const user of users) {
    try {
      await sendCheckInEmail(user.email, campaign.prompt_text, campaign.id);
      
      // Update next_checkin_due
      const nextCheckinDue = calculateNextCheckinDate(user.checkin_frequency);
      await supabase
        .from('users')
        .update({
          next_checkin_due: nextCheckinDue.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      console.log(`Check-in email sent to ${user.email}`);
    } catch (error) {
      console.error(`Error sending check-in to ${user.email}:`, error);
    }
  }
}

// src/services/email.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendCheckInEmail(
  email: string,
  promptText: string,
  campaignId: string
) {
  // Use reply-to header for inbound email handling
  // Format: reply+{user_id}@inbound.yourdomain.com
  // For now, we'll use a simpler format and extract from reply-to in Phase 4
  
  await resend.emails.send({
    from: 'Check-In System <checkin@yourdomain.com>',
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
```

#### 3.3.2 Main Application Entry Point

```typescript
// src/index.ts
import express from 'express';
import dotenv from 'dotenv';
import { startScheduler } from './services/scheduler';
import { verifyEmail } from './routes/verify';
import { registerUser } from './services/verification';
import { handleInboundEmail } from './routes/webhooks';

dotenv.config();

const app = express();
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// User registration
app.post('/api/users/register', async (req, res) => {
  try {
    const { email, checkin_frequency } = req.body;
    const user = await registerUser(email, checkin_frequency);
    res.json({ success: true, user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Email verification
app.get('/api/verify', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token required' });
    }
    const result = await verifyEmail(token);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Inbound email webhook (Phase 4)
app.post('/webhooks/email', async (req, res) => {
  try {
    await handleInboundEmail(req);
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startScheduler();
});
```

---

## Phase 4: Inbound Logic (Processing Replies)

### 4.1 Webhook Endpoint Setup

**Endpoint**: `POST /webhooks/email`

**Purpose**: Receive inbound email notifications from Resend.

**Note**: Resend uses Svix for webhook delivery. We need to verify webhook signatures for security.

### 4.2 Webhook Signature Verification

**Implementation**:
```typescript
// src/services/webhook-verification.ts
import crypto from 'crypto';

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string,
  secret: string
): boolean {
  // Resend uses Svix format: v1,{signature}
  const [version, ...signatureParts] = signature.split(',');
  
  if (version !== 'v1') {
    return false;
  }
  
  const expectedSignature = signatureParts.join(',');
  
  // Create signed content
  const signedContent = `${timestamp}.${payload}`;
  
  // Create expected signature
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(signedContent);
  const expectedSig = hmac.digest('base64');
  
  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(expectedSig)
  );
}
```

### 4.3 Inbound Email Handler

**Implementation**:
```typescript
// src/routes/webhooks.ts
import { Request, Response } from 'express';
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
  
  if (!signature || !timestamp) {
    throw new Error('Missing webhook signature headers');
  }
  
  const payload = JSON.stringify(req.body);
  const isValid = verifyWebhookSignature(
    payload,
    signature,
    timestamp,
    process.env.WEBHOOK_SECRET!
  );
  
  if (!isValid) {
    throw new Error('Invalid webhook signature');
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
```

### 4.4 Email Content Stripping

**Purpose**: Remove email signatures, quoted text, and reply headers.

**Implementation**:
```typescript
// src/services/email-parser.ts

export function stripEmailContent(content: string): string {
  let stripped = content;
  
  // Remove common reply markers
  const replyMarkers = [
    /^On .+ wrote:.*$/m,
    /^From:.*$/m,
    /^Sent:.*$/m,
    /^To:.*$/m,
    /^Subject:.*$/m,
    /^---.*$/m,
    /^_{10,}.*$/m,
    /^>.*$/m, // Quoted lines starting with >
  ];
  
  for (const marker of replyMarkers) {
    stripped = stripped.replace(marker, '');
  }
  
  // Remove HTML if present (for text extraction)
  stripped = stripped.replace(/<[^>]+>/g, '');
  stripped = stripped.replace(/&nbsp;/g, ' ');
  stripped = stripped.replace(/&amp;/g, '&');
  stripped = stripped.replace(/&lt;/g, '<');
  stripped = stripped.replace(/&gt;/g, '>');
  
  // Remove common signature patterns
  const signaturePatterns = [
    /Best regards,?.*$/is,
    /Sincerely,?.*$/is,
    /Thanks,?.*$/is,
    /Regards,?.*$/is,
    /Sent from .*$/i,
    /--\s*$/m,
  ];
  
  for (const pattern of signaturePatterns) {
    stripped = stripped.replace(pattern, '');
  }
  
  // Clean up whitespace
  stripped = stripped.trim();
  stripped = stripped.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines
  
  return stripped;
}
```

---

## Project Structure

```
checkin/
├── .env                    # Environment variables (gitignored)
├── .gitignore
├── package.json
├── tsconfig.json
├── IMPLEMENTATION_PLAN.md  # This file
├── src/
│   ├── index.ts           # Main application entry point
│   ├── services/
│   │   ├── supabase.ts    # Supabase client initialization
│   │   ├── verification.ts # User registration & verification
│   │   ├── email.ts       # Email sending functions
│   │   ├── scheduler.ts   # Cron job scheduler
│   │   ├── webhook-verification.ts # Webhook signature verification
│   │   └── email-parser.ts # Email content stripping
│   └── routes/
│       ├── verify.ts      # Email verification endpoint
│       └── webhooks.ts    # Inbound email webhook handler
└── migrations/            # SQL migration files (optional)
    └── 001_initial_schema.sql
```

---

## Next Steps

### Immediate Actions:
1. **Set up Supabase project** (or use existing)
2. **Run database migrations** to create tables
3. **Install dependencies**: `npm install`
4. **Configure environment variables** in `.env`
5. **Set up Resend domain** (Phase 1 - will be done later, but needed for testing)
6. **Implement and test each phase sequentially**

### Testing Checklist:

**Phase 2 Testing**:
- [ ] Verify all tables are created correctly
- [ ] Test RLS policies
- [ ] Verify indexes are created

**Phase 3 Testing**:
- [ ] Test user registration endpoint
- [ ] Verify verification email is sent
- [ ] Test verification endpoint with valid token
- [ ] Test verification endpoint with invalid token
- [ ] Test scheduler sends check-in emails
- [ ] Verify `next_checkin_due` is updated correctly

**Phase 4 Testing**:
- [ ] Test webhook signature verification
- [ ] Test inbound email processing
- [ ] Verify reply is stored correctly
- [ ] Test email content stripping
- [ ] Test with various email formats

---

## Notes

1. **Resend Inbound Email Setup**: Resend requires MX record configuration (Phase 1) to receive inbound emails. The webhook will be configured in the Resend dashboard once the domain is set up.

2. **Webhook Security**: Always verify webhook signatures to prevent unauthorized access.

3. **Error Handling**: Implement comprehensive error handling and logging for production use.

4. **Rate Limiting**: Consider implementing rate limiting on public endpoints.

5. **Monitoring**: Set up monitoring and alerting for failed email sends and webhook processing.

6. **Scalability**: The current scheduler runs every hour. For high-volume systems, consider using a job queue (BullMQ, etc.) instead of node-cron.

---

## References

- [Resend API Documentation](https://resend.com/docs/api-reference/emails)
- [Resend Webhooks](https://resend.com/docs/webhooks)
- [Supabase Documentation](https://supabase.com/docs)
- [Svix Webhook Verification](https://docs.svix.com/receiving/verifying-payloads/how)

