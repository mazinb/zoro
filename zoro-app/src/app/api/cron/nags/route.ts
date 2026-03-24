import { NextRequest, NextResponse } from 'next/server';
import { SUPABASE_SERVICE_ROLE_SETUP, tryGetSupabaseServiceRole } from '@/lib/supabase-server';
import { computeNextAfterSend } from '@/lib/nag-schedule';
import { normalizeNagTimeZone } from '@/lib/nag-timezone';
import { appendNagOutboundMemory } from '@/lib/nag-memory-log';
import { nagReminderHtml, nagReminderText, sendNagEmail } from '@/lib/nag-email';
import { sendNagWhatsapp } from '@/lib/nag-whatsapp';
import { postUserWebhook } from '@/lib/nag-webhook-http';
import type { NagRow } from '@/lib/nag-types';

const SELECT_FIELDS =
  'id,user_id,message,channel,webhook_id,frequency,time_hhmm,day_of_week,day_of_month,end_type,until_date,occurrences_max,occurrences_remaining,status,next_at,last_sent_at,nag_until_done,followup_interval_hours,created_at,updated_at';

function nagAppOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'https://www.getzoro.com';
  return raw.replace(/\/$/, '');
}

function authorizeDispatch(request: NextRequest): boolean {
  const key = process.env.NAG_DISPATCH_KEY;
  if (!key) return false;

  const auth = request.headers.get('authorization');
  return auth === `Bearer ${key}`;
}

async function logDispatchRun(
  supabase: NonNullable<ReturnType<typeof tryGetSupabaseServiceRole>>,
  startedAt: string,
  data: {
    ok: boolean;
    checked?: number;
    sent?: number;
    failed?: number;
    error?: string | null;
  }
): Promise<void> {
  try {
    const { error } = await supabase.from('nag_dispatch_runs').insert({
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      ok: data.ok,
      checked: data.checked ?? null,
      sent: data.sent ?? null,
      failed: data.failed ?? null,
      error: data.error ?? null,
      source: 'next_api',
    });
    if (error) {
      console.error('[cron/nags] nag_dispatch_runs insert:', error.message);
    }
  } catch (e) {
    console.error('[cron/nags] nag_dispatch_runs log failed', e);
  }
}

export async function GET(request: NextRequest) {
  return runCron(request);
}

export async function POST(request: NextRequest) {
  return runCron(request);
}

async function runCron(request: NextRequest) {
  const startedAt = new Date().toISOString();

  try {
    if (!authorizeDispatch(request)) {
      if (!process.env.NAG_DISPATCH_KEY) {
        return NextResponse.json(
          { error: 'NAG_DISPATCH_KEY not configured' },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = tryGetSupabaseServiceRole();
    if (!supabase) {
      return NextResponse.json({ error: SUPABASE_SERVICE_ROLE_SETUP }, { status: 503 });
    }
    const nowIso = new Date().toISOString();

    const { data: due, error } = await supabase
      .from('nags')
      .select(SELECT_FIELDS)
      .eq('status', 'active')
      .lte('next_at', nowIso)
      .order('next_at', { ascending: true });

    if (error) {
      await logDispatchRun(supabase, startedAt, {
        ok: false,
        checked: 0,
        sent: 0,
        failed: 0,
        error: error.message,
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (due ?? []) as NagRow[];
    let sent = 0;
    let failed = 0;

    for (const row of rows) {
      const { data: userRow } = await supabase
        .from('users')
        .select('email,timezone,verification_token')
        .eq('id', row.user_id)
        .maybeSingle();
      const { data: userDataRow } = await supabase
        .from('user_data')
        .select('shared_data')
        .eq('user_id', row.user_id)
        .maybeSingle();
      const { data: userContextRow } = await supabase
        .from('user_context')
        .select('soul_text,user_text')
        .eq('user_id', row.user_id)
        .maybeSingle();

      const to = userRow?.email;
      const userTz = normalizeNagTimeZone((userRow as { timezone?: string } | null)?.timezone);
      if (!to) {
        failed += 1;
        continue;
      }

      const subject =
        row.channel === 'webhook'
          ? `Webhook: ${row.message.slice(0, 80)}${row.message.length > 80 ? '…' : ''}`
          : `Reminder: ${row.message.slice(0, 80)}${row.message.length > 80 ? '…' : ''}`;
      const verificationToken =
        typeof (userRow as { verification_token?: string } | null)?.verification_token === 'string'
          ? ((userRow as { verification_token?: string }).verification_token || '').trim()
          : '';
      const appOrigin = nagAppOrigin();
      const manageUrl = verificationToken
        ? `${appOrigin}/nag?token=${encodeURIComponent(verificationToken)}`
        : `${appOrigin}/nag`;
      const completeUrl = verificationToken
        ? `${appOrigin}/nag?token=${encodeURIComponent(verificationToken)}&complete_nag=${encodeURIComponent(row.id)}`
        : undefined;
      const shared =
        userDataRow?.shared_data && typeof userDataRow.shared_data === 'object'
          ? (userDataRow.shared_data as Record<string, unknown>)
          : {};
      const rawOptions =
        shared.nag_personality_options && typeof shared.nag_personality_options === 'object'
          ? (shared.nag_personality_options as Record<string, unknown>)
          : {};
      const personalityEnabled = shared.nag_personality_enabled === true;
      const tone = typeof rawOptions.tone === 'string' ? rawOptions.tone : '';
      const style = typeof rawOptions.style === 'string' ? rawOptions.style : '';
      const personality = typeof shared.nag_personality === 'string' ? shared.nag_personality.trim() : '';
      const soulText =
        typeof userContextRow?.soul_text === 'string' ? userContextRow.soul_text.trim() : '';
      const userText =
        typeof userContextRow?.user_text === 'string' ? userContextRow.user_text.trim() : '';
      const personalityContext = personalityEnabled
        ? [personality, soulText, userText, tone || style ? `tone=${tone || 'friendly'}, style=${style || 'balanced'}` : '']
            .filter(Boolean)
            .join(' | ')
        : null;

      let providerId: string | undefined;
      if (row.channel === 'email') {
        const emailResult = await sendNagEmail({
          to,
          subject,
          html: nagReminderHtml({
            message: row.message,
            nagUntilDone: row.nag_until_done,
            manageUrl,
            completeUrl,
            personalityContext,
          }),
          text: nagReminderText({
            message: row.message,
            nagUntilDone: row.nag_until_done,
            manageUrl,
            completeUrl,
            personalityContext,
          }),
        });
        if (!emailResult.ok) {
          failed += 1;
          continue;
        }
        providerId = emailResult.id;
      } else if (row.channel === 'whatsapp') {
        const { data: latestSubmission } = await supabase
          .from('form_submissions')
          .select('phone,email')
          .eq('email', to)
          .not('phone', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const phone =
          typeof latestSubmission?.phone === 'string' ? latestSubmission.phone.trim() : '';
        if (!phone) {
          failed += 1;
          continue;
        }
        const waResult = await sendNagWhatsapp({ to: phone, text: row.message });
        if (!waResult.ok) {
          failed += 1;
          continue;
        }
        providerId = waResult.messageId;
      } else if (row.channel === 'webhook' && row.webhook_id) {
        const { data: hook } = await supabase
          .from('nag_webhooks')
          .select('url, secret, verified_at')
          .eq('id', row.webhook_id)
          .eq('user_id', row.user_id)
          .maybeSingle();
        if (!hook?.url || !hook.secret || !hook.verified_at) {
          failed += 1;
          continue;
        }
        const whResult = await postUserWebhook(hook.url, hook.secret, {
          type: 'zoro.nag',
          nag_id: row.id,
          message: row.message,
          next_at: row.next_at,
          manage_url: manageUrl,
          complete_url: completeUrl ?? null,
          sent_at: new Date().toISOString(),
        });
        if (!whResult.ok) {
          failed += 1;
          continue;
        }
        providerId = `webhook:${whResult.status}`;
      } else {
        failed += 1;
        continue;
      }

      sent += 1;
      const sentAt = new Date();
      void appendNagOutboundMemory(supabase, row.user_id, {
        nag_id: row.id,
        subject,
        bodyPreview: row.message.slice(0, 400),
        timestamp: sentAt.toISOString(),
        ...(providerId ? { resend_id: providerId } : {}),
      });

      const { next_at, status, occurrences_remaining } = computeNextAfterSend(row, sentAt, userTz);

      const updatePayload: Record<string, unknown> = {
        last_sent_at: sentAt.toISOString(),
        next_at: next_at ? next_at.toISOString() : null,
        occurrences_remaining,
      };
      if (status === 'archived') {
        updatePayload.status = 'archived';
      }

      await supabase.from('nags').update(updatePayload).eq('id', row.id);
    }

    const body = {
      ok: true,
      checked: rows.length,
      sent,
      failed,
    };
    await logDispatchRun(supabase, startedAt, {
      ok: true,
      checked: body.checked,
      sent: body.sent,
      failed: body.failed,
    });
    return NextResponse.json(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'cron failed';
    const supabase = tryGetSupabaseServiceRole();
    if (supabase) {
      await logDispatchRun(supabase, startedAt, {
        ok: false,
        error: msg,
      });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
