#!/usr/bin/env node
/**
 * Zoro Nags MCP server (stdio). Proxies to the Next.js Nag HTTP API.
 *
 * Env:
 *   NAG_MCP_BASE_URL     — e.g. http://localhost:3000 (no trailing slash)
 *   NAG_MCP_TOKEN        — users.verification_token (from magic link ?token=)
 *   NEXT_PUBLIC_NAG_DEV_TOKEN — optional fallback for local dev (from .env.local)
 *
 * Loads ../.env.local when present (same vars as Next).
 */

import { config } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));
const __filename = fileURLToPath(import.meta.url);
config({ path: join(__dirname, '..', '.env.local') });
config({ path: join(__dirname, '..', '.env') });

const base = (
  process.env.NAG_MCP_BASE_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
  'http://localhost:3000'
).replace(/\/$/, '');

function getHeaderValue(headers, keys) {
  for (const key of keys) {
    const value = headers[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function resolveToken(explicit, extra) {
  const t = typeof explicit === 'string' ? explicit.trim() : '';
  if (t) return t;

  // Optional per-request fallback token for remote MCP servers.
  const headers = extra?.requestInfo?.headers ?? {};
  const headerTokenRaw = getHeaderValue(headers, [
    'x-nag-mcp-token',
    'X-NAG-MCP-TOKEN',
    'x-nag-token',
    'X-NAG-TOKEN',
    // Smithery/session config style aliases (header keys can vary by client casing behavior)
    'nagMcpToken',
    'nagmcptoken',
    'nag_token',
  ]);

  const authHeaderRaw = getHeaderValue(headers, ['authorization', 'Authorization']);
  const authBearer = authHeaderRaw.startsWith('Bearer ') ? authHeaderRaw.slice('Bearer '.length).trim() : '';

  const headerToken = (headerTokenRaw || authBearer).trim();
  if (headerToken) return headerToken;

  return (
    (process.env.NAG_MCP_TOKEN || '').trim() ||
    (process.env.NEXT_PUBLIC_NAG_DEV_TOKEN || '').trim() ||
    ''
  );
}

function omitEmpty(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
}

async function fetchJson(path, init = {}) {
  const url = path.startsWith('http') ? path : `${base}${path}`;
  const headers = { 'Content-Type': 'application/json', ...init.headers };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { _parseError: true, raw: text.slice(0, 2000) };
  }
  return { ok: res.ok, status: res.status, data };
}

function jsonResult(data, isError = false) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return {
    content: [{ type: 'text', text }],
    ...(isError ? { isError: true } : {}),
  };
}

export function createNagMcpServer() {
  const server = new McpServer({
    name: 'zoro-nags',
    version: '1.0.0',
  });

  // Runtime resource capabilities for MCP clients (including Smithery scans).
  server.resource(
    'nag_api_reference',
    'zoro://nag/docs/api',
    { description: 'Nag HTTP API payloads and behavior', mimeType: 'text/markdown' },
    async () => ({
      contents: [
        {
          uri: 'zoro://nag/docs/api',
          mimeType: 'text/markdown',
          text: [
            '# Zoro Nags API',
            '',
            '- Start auth: `onboarding.email_check` -> `onboarding.auth_email` (confirm_send=true).',
            '- For authenticated operations, provide token via `x-nag-mcp-token` or `Authorization: Bearer <token>`.',
            '- Core tools: `nags.parse`, `nags.list`, `nags.create`, `nags.update`, `nags.delete`.',
            '- Main-site reminders (wealth pages): `reminders.list`, `reminders.create`, `reminders.delete` → `/api/reminders`.',
            '- Webhook tools: `webhooks.register`, `webhooks.verify`, `webhooks.ping`, `webhooks.list`, `webhooks.delete`.',
          ].join('\n'),
        },
      ],
    })
  );

  server.resource(
    'nag_auth_guide',
    'zoro://nag/docs/auth',
    { description: 'Token and email auth model for zoro-nags', mimeType: 'text/markdown' },
    async () => ({
      contents: [
        {
          uri: 'zoro://nag/docs/auth',
          mimeType: 'text/markdown',
          text: [
            '# Zoro Nags Auth',
            '',
            '- Email-first onboarding: `onboarding.email_check`, then `onboarding.auth_email`.',
            '- Existing users receive a magic link email to `/nag?token=...`.',
            '- Use `profile.reset_token` to rotate compromised tokens.',
            '- Tool-level `token` argument always overrides header/env fallback.',
          ].join('\n'),
        },
      ],
    })
  );

  // Runtime prompt capabilities for MCP clients (including Smithery scans).
  server.prompt(
    'onboarding.onboard_user',
    'Onboard a user and send magic link',
    {
      email: z.string().email().describe('User email'),
      name: z.string().optional().describe('Required for first-time signup'),
    },
    async ({ email, name }) => ({
      description: 'Onboard user with consented magic-link flow.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              `Help this user start using Zoro Nags: ${email}.`,
              '1) Call onboarding.email_check.',
              '2) If not registered, collect name then call onboarding.auth_email with confirm_send=true.',
              '3) If registered, call onboarding.auth_email with confirm_send=true.',
              name ? `Provided name for signup: ${name}` : 'Ask for name only if the account does not exist.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'nags.create_from_text',
    'Parse natural language then create nag',
    {
      request_text: z.string().min(1).describe('Natural language reminder request'),
      channel: z.enum(['email', 'whatsapp']).optional().describe('Preferred default channel'),
    },
    async ({ request_text, channel }) => ({
      description: 'Parse then create a nag from plain English.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              `Create a reminder from this request: ${request_text}`,
              `Use default channel: ${channel || 'email'}.`,
              'Workflow: call nags.parse -> confirm draft fields -> call nags.create.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'webhooks.register_and_verify',
    'Register and verify a webhook endpoint',
    {
      webhook_url: z.string().url().describe('HTTPS endpoint that will receive webhook events'),
      token: z.string().optional().describe('Auth token override if not set in MCP headers'),
    },
    async ({ webhook_url, token }) => ({
      description: 'Create, verify, and smoke-test a user webhook with concise status output.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              `Register this webhook endpoint: ${webhook_url}`,
              token ? `Use token override: ${token}` : 'Use configured x-nag-mcp-token / Authorization bearer token.',
              'Flow:',
              '1) Call webhooks.register',
              '2) Call webhooks.verify',
              '3) Call webhooks.ping (optional)',
              'Return ids and verification/ping result; if any step fails, return exact API error and stop.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'nags.triage_overdue',
    'Review active nags and suggest cleanup',
    {
      include_archived: z.boolean().optional().describe('Include archived nags in review'),
    },
    async ({ include_archived }) => ({
      description: 'List nags and recommend updates for overdue/noisy reminders.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'Review this user nag setup and suggest improvements.',
              `List status to inspect: ${include_archived ? 'all' : 'active'}.`,
              'Call nags.list first, then suggest message/schedule/follow-up changes and apply with nags.update if user confirms.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.tool(
    'onboarding.email_check',
    'Check if an email is already registered (no email sent).',
    {
      email: z.string().email().describe('Email to check'),
    },
    {
      title: 'Check Nag Email',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async ({ email }) => {
      const { ok, status, data } = await fetchJson('/api/auth/nag-email-check', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      return jsonResult(data, !ok || status >= 400);
    }
  );

  server.tool(
    'onboarding.request_link',
    'Create user (if needed) and send a Nags magic link email. Requires user consent; only send when confirm_send=true. Optionally sets user timezone (used for future nags, not existing scheduled next_at). New users must provide name.',
    {
      email: z.string().email(),
      name: z.string().optional().describe('Required when email is not yet registered'),
      timezone: z.string().optional().describe('Optional IANA timezone to set on the user (used going forward)'),
      confirm_send: z.boolean().optional().describe('Must be true to actually send the email (requires user consent)'),
    },
    {
      title: 'Request Nag Magic Link',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ email, name, timezone, confirm_send }) => {
      if (confirm_send !== true) {
        return jsonResult(
          { error: 'User consent required: set confirm_send=true to create/send the magic link.' },
          true
        );
      }
      const body = omitEmpty({
        email: email.trim().toLowerCase(),
        name: name?.trim(),
        timezone: timezone?.trim() || undefined,
      });
      const { ok, status, data } = await fetchJson('/api/auth/nag-request-link', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return jsonResult(data, !ok || status >= 400);
    }
  );

  server.tool(
    'onboarding.auth_email',
    'Email-first auth helper: creates user if needed and sends magic link. Existing users can omit name.',
    {
      email: z.string().email().describe('Email address to authenticate'),
      name: z.string().optional().describe('Required only if email is not registered yet'),
      timezone: z.string().optional().describe('Optional IANA timezone for signup/profile'),
      confirm_send: z.boolean().optional().describe('Must be true to send the magic link email'),
    },
    {
      title: 'Authenticate by Email',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ email, name, timezone, confirm_send }) => {
      if (confirm_send !== true) {
        return jsonResult(
          { error: 'User consent required: set confirm_send=true to send sign-in/signup magic link.' },
          true
        );
      }
      const body = omitEmpty({
        email: email.trim().toLowerCase(),
        name: name?.trim(),
        timezone: timezone?.trim() || undefined,
      });
      const { ok, status, data } = await fetchJson('/api/auth/nag-request-link', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return jsonResult(data, !ok || status >= 400);
    }
  );

  server.tool(
    'nags.parse',
    'Parse natural language into a schedule draft (uses OpenAI when configured on the app).',
    {
      text: z.string().min(1).describe('What the user wants reminded, e.g. mow lawn every Tuesday'),
      token: z.string().optional().describe('Override NAG_MCP_TOKEN for this call'),
      default_channel: z.enum(['email', 'whatsapp']).optional().describe('Fallback delivery channel for parsed draft'),
    },
    {
      title: 'Parse Reminder Text',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async ({ text, token, default_channel }, extra) => {
      const t = resolveToken(token, extra);
      if (!t) {
        return jsonResult(
          { error: 'token required (argument or NAG_MCP_TOKEN / NEXT_PUBLIC_NAG_DEV_TOKEN)' },
          true
        );
      }
      const { ok, status, data } = await fetchJson('/api/nag-parse', {
        method: 'POST',
        body: JSON.stringify(
          omitEmpty({
            token: t,
            text: text.trim(),
            default_channel: default_channel || 'email',
          })
        ),
      });
      return jsonResult(data, !ok || status >= 400);
    }
  );

server.tool(
  'nags.list',
  'List nags for the user (active, archived, cancelled, or all).',
  {
    token: z.string().optional().describe('Auth token override (users.verification_token)'),
    status: z.enum(['active', 'archived', 'cancelled', 'all']).optional().default('active'),
  },
  {
    title: 'List Nags',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  async ({ token, status }, extra) => {
    const t = resolveToken(token, extra);
    if (!t) {
      return jsonResult({ error: 'token required (argument or NAG_MCP_TOKEN)' }, true);
    }
    const q = new URLSearchParams({ token: t, status: status || 'active' });
    const { ok, data } = await fetchJson(`/api/nags?${q}`, { method: 'GET' });
    return jsonResult(data, !ok);
  }
);

server.tool(
  'reminders.list',
  'List main-site recurring reminders (income/assets/expenses context) from the `reminders` table.',
  {
    token: z.string().optional().describe('Auth token override (users.verification_token)'),
  },
  {
    title: 'List reminders',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  async ({ token }, extra) => {
    const t = resolveToken(token, extra);
    if (!t) return jsonResult({ error: 'token required' }, true);
    const q = new URLSearchParams({ token: t });
    const { ok, status, data } = await fetchJson(`/api/reminders?${q}`, { method: 'GET' });
    return jsonResult(data, !ok || status >= 400);
  }
);

server.tool(
  'reminders.create',
  'Create a main-site reminder (same as AddReminderForm on /income, /assets, /expenses). Not the same row type as `nags`.',
  {
    token: z.string().optional(),
    description: z.string().min(1).describe('Reminder label'),
    context: z.enum(['income', 'assets', 'expenses']),
    recurrence: z.enum(['monthly', 'quarterly', 'annually']).optional().default('monthly'),
    recurrence_day: z.number().int().min(1).max(31).optional(),
    recurrence_week: z.number().int().min(1).max(4).optional(),
    recurrence_month: z.number().int().min(1).max(12).optional(),
    priority: z.string().optional(),
  },
  {
    title: 'Create reminder',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  async (args, extra) => {
    const t = resolveToken(args.token, extra);
    if (!t) return jsonResult({ error: 'token required' }, true);
    const { token: _tok, ...body } = args;
    const { ok, status, data } = await fetchJson('/api/reminders', {
      method: 'POST',
      body: JSON.stringify({
        token: t,
        description: body.description,
        context: body.context,
        recurrence: body.recurrence,
        recurrence_day: body.recurrence_day,
        recurrence_week: body.recurrence_week,
        recurrence_month: body.recurrence_month,
        priority: body.priority,
      }),
    });
    return jsonResult(data, !ok || status >= 400);
  }
);

server.tool(
  'reminders.delete',
  'Delete a main-site reminder row by id (from reminders.list).',
  {
    reminder_id: z.string().uuid().describe('Reminder UUID'),
    token: z.string().optional(),
  },
  {
    title: 'Delete reminder',
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  async ({ reminder_id, token }, extra) => {
    const t = resolveToken(token, extra);
    if (!t) return jsonResult({ error: 'token required' }, true);
    const q = new URLSearchParams({ token: t, id: reminder_id });
    const { ok, status, data } = await fetchJson(`/api/reminders?${q}`, { method: 'DELETE' });
    return jsonResult(data, !ok || status >= 400);
  }
);

server.tool(
  'nags.sent_log',
  'List recent nag reminder emails from user_context.memory_jsonb (outbound entries with nag_id or Reminder: subject).',
  {
    token: z.string().optional().describe('Auth token override (users.verification_token)'),
    nag_id: z.string().uuid().optional().describe('Filter to one nag'),
    limit: z.number().int().min(1).max(200).optional().default(50).describe('Max entries to return (1-200)'),
  },
  {
    title: 'List Sent Log',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  async ({ token, nag_id, limit }, extra) => {
    const t = resolveToken(token, extra);
    if (!t) return jsonResult({ error: 'token required' }, true);
    const q = new URLSearchParams({ token: t, limit: String(limit ?? 50) });
    if (nag_id) q.set('nag_id', nag_id);
    const { ok, status, data } = await fetchJson(`/api/nags/sent-log?${q}`, { method: 'GET' });
    return jsonResult(data, !ok || status >= 400);
  }
);

server.tool(
  'nags.create',
  'Create a new nag.',
  {
    token: z.string().optional().describe('Auth token override (users.verification_token)'),
    message: z.string().min(1).describe('Reminder message body'),
    channel: z.enum(['email', 'whatsapp', 'webhook']).describe('Delivery channel'),
    webhook_id: z.string().uuid().optional().describe('Required when channel=webhook'),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'once']).describe('Reminder frequency'),
    time_hhmm: z.string().describe('24h HH:MM in user timezone'),
    day_of_week: z.number().int().min(0).max(6).optional().describe('0=Mon … 6=Sun; weekly only'),
    day_of_month: z.number().int().min(1).max(31).optional().describe('monthly only'),
    end_type: z.enum(['forever', 'until_date', 'occurrences']).describe('When reminder series should end'),
    until_date: z.string().optional().describe('YYYY-MM-DD if until_date or once'),
    occurrences_max: z.number().int().positive().optional().describe('Max occurrences when end_type=occurrences'),
    nag_until_done: z.boolean().optional().describe('Email only: follow up until user marks done'),
    followup_interval_hours: z.number().int().min(1).max(336).optional().describe('Hours between follow-ups; omit for default from frequency'),
  },
  {
    title: 'Create Nag',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  async (args, extra) => {
    const t = resolveToken(args.token, extra);
    if (!t) return jsonResult({ error: 'token required' }, true);
    const { token: _x, ...rest } = args;
    const body = omitEmpty({ token: t, ...rest });
    const { ok, status, data } = await fetchJson('/api/nags', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return jsonResult(data, !ok || status >= 400);
  }
);

server.tool(
  'nags.update',
  'PATCH an existing nag (schedule fields, message, status archive/cancel, etc.).',
  {
    nag_id: z.string().uuid().describe('Nag UUID to patch'),
    token: z.string().optional().describe('Auth token override (users.verification_token)'),
    message: z.string().optional().describe('Updated reminder message'),
    channel: z.enum(['email', 'whatsapp', 'webhook']).optional().describe('Updated delivery channel'),
    webhook_id: z.string().uuid().nullable().optional().describe('Webhook UUID when channel=webhook; null clears'),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'once']).optional().describe('Updated reminder frequency'),
    time_hhmm: z.string().optional().describe('Updated 24h HH:MM time in user timezone'),
    day_of_week: z.number().int().min(0).max(6).optional().describe('Weekly only: 0=Mon … 6=Sun'),
    day_of_month: z.number().int().min(1).max(31).optional().describe('Monthly only: day 1..31'),
    end_type: z.enum(['forever', 'until_date', 'occurrences']).optional().describe('Updated end condition'),
    until_date: z.string().optional().describe('Updated until date YYYY-MM-DD'),
    occurrences_max: z.number().int().positive().optional().describe('Updated max occurrences when applicable'),
    status: z.enum(['active', 'archived', 'cancelled']).optional().describe('Updated lifecycle status'),
    nag_until_done: z.boolean().optional().describe('Email only: whether to follow up until task is done'),
    followup_interval_hours: z.number().int().min(1).max(336).nullable().optional().describe('Hours between follow-ups or null to clear'),
    task_completed: z
      .boolean()
      .optional()
      .describe(
        'Mark current cycle done: archives the nag and stores the next would-be run time (restore via status active). Do not combine with schedule fields.'
      ),
  },
  {
    title: 'Update Nag',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  async (args, extra) => {
    const t = resolveToken(args.token, extra);
    if (!t) return jsonResult({ error: 'token required' }, true);
    const { nag_id, token: _x, ...patch } = args;
    const body = omitEmpty({ token: t, ...patch });
    const { ok, status, data } = await fetchJson(`/api/nags/${nag_id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return jsonResult(data, !ok || status >= 400);
  }
);

server.tool(
  'nags.delete',
  'Soft-cancel a nag (DELETE — sets status cancelled).',
  {
    nag_id: z.string().uuid().describe('Nag UUID to cancel'),
    token: z.string().optional().describe('Auth token override (users.verification_token)'),
  },
  {
    title: 'Cancel Nag',
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  async ({ nag_id, token }, extra) => {
    const t = resolveToken(token, extra);
    if (!t) return jsonResult({ error: 'token required' }, true);
    const q = new URLSearchParams({ token: t });
    const { ok, status, data } = await fetchJson(`/api/nags/${nag_id}?${q}`, { method: 'DELETE' });
    return jsonResult(data, !ok || status >= 400);
  }
);

server.tool(
  'profile.reset_token',
    'Rotate your token. The new token is returned (no email is sent).',
  {
    token: z.string().optional().describe('Current auth token to rotate'),
  },
  {
    title: 'Reset Nag Token',
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
  async ({ token }, extra) => {
    const t = resolveToken(token, extra);
    if (!t) return jsonResult({ error: 'token required' }, true);
    const { ok, status, data } = await fetchJson('/api/auth/nag-reset-token', {
      method: 'POST',
      body: JSON.stringify({ token: t }),
    });
    return jsonResult(data, !ok || status >= 400);
  }
);

server.tool(
  'profile.get_user_data',
  'Fetch user + shared_data by token.',
  {
    token: z.string().optional().describe('Auth token override (users.verification_token)'),
  },
  {
    title: 'Get User Data',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  async ({ token }, extra) => {
    const t = resolveToken(token, extra);
    if (!t) return jsonResult({ error: 'token required' }, true);
    const q = new URLSearchParams({ token: t });
    const { ok, status, data } = await fetchJson(`/api/user-data?${q}`, { method: 'GET' });
    return jsonResult(data, !ok || status >= 400);
  }
);

server.tool(
  'webhooks.list',
  'List registered webhooks for the authenticated user.',
  {
    token: z.string().optional().describe('Auth token override (users.verification_token or user_data.user_token)'),
  },
  {
    title: 'List Webhooks',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  async ({ token }, extra) => {
    const t = resolveToken(token, extra);
    if (!t) return jsonResult({ error: 'token required' }, true);
    const q = new URLSearchParams({ token: t });
    const { ok, status, data } = await fetchJson(`/api/nag-webhooks?${q}`, { method: 'GET' });
    return jsonResult(data, !ok || status >= 400);
  }
);

server.tool(
  'webhooks.register',
  'Register a webhook endpoint for the authenticated user. HTTPS required. Max 10 webhooks per user.',
  {
    url: z.string().url().describe('Webhook endpoint URL (must be HTTPS)'),
    token: z.string().optional().describe('Auth token override'),
  },
  {
    title: 'Register Webhook',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  async ({ url, token }, extra) => {
    const t = resolveToken(token, extra);
    if (!t) return jsonResult({ error: 'token required' }, true);
    const { ok, status, data } = await fetchJson('/api/nag-webhooks', {
      method: 'POST',
      body: JSON.stringify({ token: t, url: url.trim() }),
    });
    return jsonResult(data, !ok || status >= 400);
  }
);

server.tool(
  'webhooks.verify',
  'Verify a registered webhook by sending challenge payload and expecting challenge echo in JSON.',
  {
    webhook_id: z.string().uuid().describe('Webhook UUID to verify'),
    token: z.string().optional().describe('Auth token override'),
  },
  {
    title: 'Verify Webhook',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  async ({ webhook_id, token }, extra) => {
    const t = resolveToken(token, extra);
    if (!t) return jsonResult({ error: 'token required' }, true);
    const { ok, status, data } = await fetchJson(`/api/nag-webhooks/${webhook_id}/verify`, {
      method: 'POST',
      body: JSON.stringify({ token: t }),
    });
    return jsonResult(data, !ok || status >= 400);
  }
);

server.tool(
  'webhooks.ping',
  'Send test ping event to a verified webhook.',
  {
    webhook_id: z.string().uuid().describe('Webhook UUID to ping'),
    token: z.string().optional().describe('Auth token override'),
  },
  {
    title: 'Ping Webhook',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  async ({ webhook_id, token }, extra) => {
    const t = resolveToken(token, extra);
    if (!t) return jsonResult({ error: 'token required' }, true);
    const { ok, status, data } = await fetchJson(`/api/nag-webhooks/${webhook_id}/ping`, {
      method: 'POST',
      body: JSON.stringify({ token: t }),
    });
    return jsonResult(data, !ok || status >= 400);
  }
);

server.tool(
  'webhooks.delete',
  'Delete a webhook registration.',
  {
    webhook_id: z.string().uuid().describe('Webhook UUID to delete'),
    token: z.string().optional().describe('Auth token override'),
  },
  {
    title: 'Delete Webhook',
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  async ({ webhook_id, token }, extra) => {
    const t = resolveToken(token, extra);
    if (!t) return jsonResult({ error: 'token required' }, true);
    const q = new URLSearchParams({ token: t });
    const { ok, status, data } = await fetchJson(`/api/nag-webhooks/${webhook_id}?${q}`, { method: 'DELETE' });
    return jsonResult(data, !ok || status >= 400);
  }
);

server.tool(
  'profile.set_timezone',
  'Set user IANA timezone for future scheduling (does not change already-scheduled next_at).',
  {
    timezone: z.string().min(1).describe('IANA zone e.g. America/New_York'),
    token: z.string().optional().describe('Auth token override (users.verification_token)'),
  },
  {
    title: 'Set Nag Timezone',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  async ({ timezone, token }, extra) => {
    const t = resolveToken(token, extra);
    if (!t) return jsonResult({ error: 'token required' }, true);
    const { ok, status, data } = await fetchJson('/api/nag-profile', {
      method: 'PATCH',
      body: JSON.stringify({ token: t, timezone: timezone.trim() }),
    });
    return jsonResult(data, !ok || status >= 400);
  }
);

return server;
}

// Only attach the stdio transport when this module is executed directly.
if (process.argv[1] && __filename === process.argv[1]) {
  const server = createNagMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
