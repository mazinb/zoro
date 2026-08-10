# Email Conversations Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add a general send endpoint, a reply endpoint, and a conversation thread view to the Zoro app's email system using the existing Resend integration.

**Architecture:** Two API routes (`POST /api/email/send`, `POST /api/email/reply`) + extend existing `GET /api/profile` to surface outbound emails. **Zero new DB tables** — leverage existing `inbound_emails` table + `user_context.memory_jsonb` (same pattern as nag-memory-log.ts for tracking outbound emails).

**Tech Stack:** Next.js 16 (App Router), TypeScript, Resend API (v4), Supabase (PostgreSQL), Zod (validation).

---

## Background: What Exists

| Component | Status |
|---|---|
| Resend send | ✅ Scattered across `nag-email.ts`, `nag-magic-link-mail.ts`, `select-option/route.ts` — all use raw `fetch()` to `https://api.resend.com/emails` |
| Resend env vars | ✅ `RESEND_API_KEY`, `RESEND_FROM` |
| Inbound emails | ✅ `inbound_emails` table in Supabase, populated by Resend webhooks |
| Outbound tracking | ✅ `user_context.memory_jsonb` already stores outbound email entries as `{ type: 'outbound', timestamp, subject, bodyPreview, nag_id?, resend_id?, in_reply_to? }` (see `nag-memory-log.ts`) |
| Profile GET | ✅ Returns inbounds + memory_jsonb + usage stats |
| General send endpoint | ❌ Doesn't exist |
| Reply endpoint | ❌ Doesn't exist |
| Conversation view (paired inbound+outbound) | ❌ Inbounds returned but outbounds not surfaced from memory_jsonb |

Existing `inbound_emails` columns: `id, user_id, from_address, subject, received_at, intent, intent_type, intent_confidence, intent_rationale, requires_human_review, user_flagged_for_review, user_review_comment, text_body`

Existing auth pattern: token → `resolveTokenToUserId()` → userId

Existing memory_jsonb outbound structure (from nag-memory-log.ts):
```typescript
{ type: 'outbound', timestamp: string, subject: string, bodyPreview: string, nag_id: string, resend_id?: string }
```

We'll extend this to support `in_reply_to` for email threading, keeping `nag_id` optional so we distinguish nag outbounds from general email outbounds.

---

## Task 1: Create Shared Email Send Utility

**Objective:** Extract Resend sending into a reusable utility that sends via Resend + appends to `user_context.memory_jsonb`. Both `send` and `reply` endpoints use this.

**Files:**
- Create: `src/lib/email-send.ts`

**Code:**

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServiceRole } from './supabase-server';

export type SendEmailParams = {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  inReplyTo?: string; // inbound UUID for threading
  userId: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Sends an email via Resend and logs it to user_context.memory_jsonb
 * (same store used for nag outbound tracking).
 */
export async function sendEmailViaResend(
  params: SendEmailParams,
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM || 'Zoro <admin@getzoro.com>';

  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY not configured' };
  }

  let resendId: string | undefined;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(params.inReplyTo ? { 'In-Reply-To': params.inReplyTo } : {}),
      },
      body: JSON.stringify({
        from: params.from || fromAddress,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        ...(params.inReplyTo ? { in_reply_to: params.inReplyTo } : {}),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: errText || `HTTP ${res.status}` };
    }

    const json = await res.json() as { id?: string };
    resendId = json.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'send failed';
    return { ok: false, error: msg };
  }

  // Log to user_context.memory_jsonb (same pattern as nag-memory-log.ts)
  try {
    const supabase = getSupabaseServiceRole();
    const timestamp = new Date().toISOString();

    const { data: row } = await supabase
      .from('user_context')
      .select('memory_jsonb')
      .eq('user_id', params.userId)
      .maybeSingle();

    if (row) {
      const mem = Array.isArray(row.memory_jsonb) ? [...(row.memory_jsonb as unknown[])] : [];
      const entry = {
        type: 'outbound',
        timestamp,
        subject: params.subject,
        bodyPreview: (params.text ?? params.html ?? '').slice(0, 200),
        resend_id: resendId,
        in_reply_to: params.inReplyTo ?? null,
      } as Record<string, unknown>;
      mem.push(entry);

      // Keep last 50 entries to avoid unbounded growth
      const trimmed = mem.slice(-50);

      await supabase
        .from('user_context')
        .update({ memory_jsonb: trimmed, updated_at: timestamp })
        .eq('user_id', params.userId);
    }
  } catch (dbErr) {
    console.error('[email-send] memory_jsonb log failed:', dbErr);
    // Don't fail the send — email went out, just logging failed
  }

  return { ok: true, id: resendId ?? '' };
}
```

**Steps:**
1. Create the file with full code above
2. Verify TypeScript compiles: `npx tsc --noEmit` in zoro-app dir

**Verification:**
- File created at `src/lib/email-send.ts`
- No TypeScript errors
- Imports from existing `supabase-server.ts`
- Appends to `user_context.memory_jsonb` (not a new table)

---

## Task 2: Create `POST /api/email/send` Endpoint

**Objective:** General-purpose send endpoint. Takes `to`, `subject`, `body` (text or html). Validates via token auth. Sends via Resend.

**Files:**
- Create: `src/app/api/email/send/route.ts`

**Code:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { sendEmailViaResend } from '@/lib/email-send';
import { resolveTokenToUserId } from '@/lib/resolve-token';
import { z } from 'zod';

const SendSchema = z.object({
  to: z.string().email('Invalid recipient email'),
  subject: z.string().min(1, 'Subject is required').max(200),
  body: z.string().min(1, 'Body is required'),
  html: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    const userIdResult = await resolveTokenToUserId(token);
    if ('error' in userIdResult) {
      return NextResponse.json({ error: userIdResult.error }, { status: userIdResult.status });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = SendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { to, subject, body: emailBody, html } = parsed.data;
    const fromAddress = process.env.RESEND_FROM || 'Zoro <admin@getzoro.com>';

    const result = await sendEmailViaResend({
      userId: userIdResult.userId,
      from: fromAddress,
      to,
      subject,
      ...(html ? { html: emailBody } : { text: emailBody }),
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({ ok: true, id: result.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

**Steps:**
1. Create the route file with full code
2. Verify compilation

**Verification:**
- Endpoint at `POST /api/email/send?token=<userToken>`
- Accepts `{ to, subject, body, html?: boolean }`
- Returns `{ ok: true, id: "<resend-id>" }` on success
- Returns 400 for validation errors, 502 for send failures

---

## Task 3: Create `POST /api/email/reply` Endpoint

**Objective:** Reply to an existing inbound email. Looks up the inbound, extracts the recipient address (the user's Zoro email), and sends a reply with proper threading headers.

**Files:**
- Create: `src/app/api/email/reply/route.ts`

**Code:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { sendEmailViaResend } from '@/lib/email-send';
import { resolveTokenToUserId } from '@/lib/resolve-token';
import { z } from 'zod';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

const ReplySchema = z.object({
  inbound_id: z.string().uuid('Invalid inbound_id'),
  body: z.string().min(1, 'Body is required'),
  html: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    const userIdResult = await resolveTokenToUserId(token);
    if ('error' in userIdResult) {
      return NextResponse.json({ error: userIdResult.error }, { status: userIdResult.status });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = ReplySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { inbound_id: inboundId, body: replyBody, html } = parsed.data;

    // Look up the inbound email to find the sender and threading info
    const supabase = getSupabaseServiceRole();
    const { data: inbound, error: fetchError } = await supabase
      .from('inbound_emails')
      .select('from_address, subject, id')
      .eq('id', inboundId)
      .eq('user_id', userIdResult.userId)
      .single();

    if (fetchError || !inbound) {
      return NextResponse.json(
        { error: 'Inbound email not found or access denied' },
        { status: 404 }
      );
    }

    const fromAddress = process.env.RESEND_FROM || 'Zoro <admin@getzoro.com>';

    const subject = inbound.subject?.startsWith('Re: ') ? inbound.subject : `Re: ${inbound.subject || ''}`;

    const result = await sendEmailViaResend({
      userId: userIdResult.userId,
      from: fromAddress,
      to: inbound.from_address,
      subject,
      ...(html ? { html: replyBody } : { text: replyBody }),
      inReplyTo: inboundId, // use inbound UUID for threading
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({ ok: true, id: result.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

**Steps:**
1. Create the route file with full code
2. Verify compilation

**Verification:**
- Endpoint at `POST /api/email/reply?token=<userToken>`
- Accepts `{ inbound_id, body, html?: boolean }`
- Replies to the original sender (`from_address` of the inbound)
- Sets `Re: ` on subject if not already present
- Uses proper threading via `in_reply_to`

---

## Task 4: Extend `GET /api/profile` to Return Email Outbounds

**Objective:** Parse `memory_jsonb` from the existing profile response to extract email outbounds (distinguishing them from nag entries) and surface them alongside inbounds for conversation pairing.

**Files:**
- Modify: `src/app/api/profile/route.ts`

**Changes needed:**

In the existing profile route, after fetching `memory_jsonb`, parse out email outbound entries:

```typescript
// After fetching memoryJsonb, filter for email outbounds:
const emailOutbounds = (memoryJsonb as unknown[] ?? [])
  .filter(item => {
    if (typeof item !== 'object' || !item) return false;
    const o = item as Record<string, unknown>;
    return o.type === 'outbound' && typeof o.resend_id === 'string';
  })
  .map(item => {
    const o = item as Record<string, unknown>;
    return {
      id: o.resend_id as string,
      subject: (o.subject as string) ?? '',
      body_preview: (o.bodyPreview as string) ?? '',
      created_at: (o.timestamp as string) ?? '',
      in_reply_to: (o.in_reply_to as string) ?? null,
    };
  })
  .sort((a, b) => (b.created_at > a.created_at ? 1 : -1));

// Add to response:
response.outbounds = emailOutbounds;
```

Key distinction: nag outbounds have `nag_id`, general email outbounds have `resend_id` (and optionally `in_reply_to`). We filter on `resend_id` presence.

**Steps:**
1. After the existing `memoryJsonb` fetch, add filtering logic
2. Add `outbounds` array to the response object (alongside existing `inbounds`, `usage`, etc.)
3. Keep existing `pairInboundsWithReplies` logic unchanged — just add the new `outbounds` field

**Verification:**
- `GET /api/profile?token=...` returns existing fields PLUS `outbounds` array
- `outbounds` ordered by `created_at` DESC
- Each outbound has `in_reply_to` (null for unsolicited, UUID for replies)
- Nag entries are excluded (they have `nag_id` but no `resend_id`)

---

## Task 5: Test & Verify

**Objective:** Run the Next.js build to ensure everything compiles.

**Steps:**
1. Run `cd /home/mazin/zoro/zoro-app && npx tsc --noEmit`
2. Fix any TypeScript errors

**Commands:**
```bash
cd /home/mazin/zoro/zoro-app
npx tsc --noEmit
```

---

## File Summary

| File | Action |
|---|---|
| `src/lib/email-send.ts` | **Create** — shared send utility (Resend + memory_jsonb log) |
| `src/app/api/email/send/route.ts` | **Create** — general send endpoint |
| `src/app/api/email/reply/route.ts` | **Create** — reply endpoint |
| `src/app/api/profile/route.ts` | **Modify** — add `outbounds` parsed from memory_jsonb |

**No new DB tables created.** Uses existing `inbound_emails` + `user_context.memory_jsonb`.

---

## Risks & Trade-offs

1. **memory_jsonb grows** — capped at 50 most recent entries per user (handled in Task 1)
2. **No email template support** — YAGNI. Body is plain text or raw HTML. Can add later.
3. **Threading is simple** — pairs by `in_reply_to` UUID. No deep thread collapsing needed for MVP.
4. **No send limits/rate limiting** — existing `usage_events` pattern could be extended later if needed.
5. **Nag entries still in memory_jsonb** — we filter on `resend_id` presence, so nags (which use `nag_id`) are excluded from the email outbounds list.
