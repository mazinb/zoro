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
config({ path: join(__dirname, '..', '.env.local') });
config({ path: join(__dirname, '..', '.env') });

const base = (process.env.NAG_MCP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

function resolveToken(explicit) {
  const t = typeof explicit === 'string' ? explicit.trim() : '';
  if (t) return t;
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

const server = new McpServer({
  name: 'zoro-nags',
  version: '1.0.0',
});

server.tool(
  'nag_email_check',
  'Check if an email is already registered (no email sent).',
  {
    email: z.string().email().describe('Email to check'),
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
  'nag_request_link',
  'Send magic link to open Nags. New users must provide name.',
  {
    email: z.string().email(),
    name: z.string().optional().describe('Required when email is not yet registered'),
  },
  async ({ email, name }) => {
    const body = omitEmpty({
      email: email.trim().toLowerCase(),
      name: name?.trim(),
    });
    const { ok, status, data } = await fetchJson('/api/auth/nag-request-link', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return jsonResult(data, !ok || status >= 400);
  }
);

server.tool(
  'nag_parse',
  'Parse natural language into a schedule draft (uses OpenAI when configured on the app).',
  {
    text: z.string().min(1).describe('What the user wants reminded, e.g. mow lawn every Tuesday'),
    token: z.string().optional().describe('Override NAG_MCP_TOKEN for this call'),
    default_channel: z.enum(['email', 'whatsapp']).optional(),
  },
  async ({ text, token, default_channel }) => {
    const t = resolveToken(token);
    if (!t) {
      return jsonResult({ error: 'token required (argument or NAG_MCP_TOKEN / NEXT_PUBLIC_NAG_DEV_TOKEN)' }, true);
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
  'nags_list',
  'List nags for the user (active, archived, cancelled, or all).',
  {
    token: z.string().optional(),
    status: z.enum(['active', 'archived', 'cancelled', 'all']).optional().default('active'),
  },
  async ({ token, status }) => {
    const t = resolveToken(token);
    if (!t) {
      return jsonResult({ error: 'token required (argument or NAG_MCP_TOKEN)' }, true);
    }
    const q = new URLSearchParams({ token: t, status: status || 'active' });
    const { ok, data } = await fetchJson(`/api/nags?${q}`, { method: 'GET' });
    return jsonResult(data, !ok);
  }
);

server.tool(
  'nags_sent_log',
  'List recent nag reminder emails from user_context.memory_jsonb (outbound entries with nag_id or Reminder: subject).',
  {
    token: z.string().optional(),
    nag_id: z.string().uuid().optional().describe('Filter to one nag'),
    limit: z.number().int().min(1).max(200).optional().default(50),
  },
  async ({ token, nag_id, limit }) => {
    const t = resolveToken(token);
    if (!t) return jsonResult({ error: 'token required' }, true);
    const q = new URLSearchParams({ token: t, limit: String(limit ?? 50) });
    if (nag_id) q.set('nag_id', nag_id);
    const { ok, status, data } = await fetchJson(`/api/nags/sent-log?${q}`, { method: 'GET' });
    return jsonResult(data, !ok || status >= 400);
  }
);

server.tool(
  'nags_create',
  'Create a new nag.',
  {
    token: z.string().optional(),
    message: z.string().min(1),
    channel: z.enum(['email', 'whatsapp']),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'once']),
    time_hhmm: z.string().describe('24h HH:MM in user timezone'),
    day_of_week: z.number().int().min(0).max(6).optional().describe('0=Mon … 6=Sun; weekly only'),
    day_of_month: z.number().int().min(1).max(31).optional().describe('monthly only'),
    end_type: z.enum(['forever', 'until_date', 'occurrences']),
    until_date: z.string().optional().describe('YYYY-MM-DD if until_date or once'),
    occurrences_max: z.number().int().positive().optional(),
    nag_until_done: z.boolean().optional().describe('Email only: follow up until user marks done'),
    followup_interval_hours: z.number().int().min(1).max(336).optional().describe('Hours between follow-ups; omit for default from frequency'),
  },
  async (args) => {
    const t = resolveToken(args.token);
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
  'nags_update',
  'PATCH an existing nag (schedule fields, message, status archive/cancel, etc.).',
  {
    nag_id: z.string().uuid(),
    token: z.string().optional(),
    message: z.string().optional(),
    channel: z.enum(['email', 'whatsapp']).optional(),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'once']).optional(),
    time_hhmm: z.string().optional(),
    day_of_week: z.number().int().min(0).max(6).optional(),
    day_of_month: z.number().int().min(1).max(31).optional(),
    end_type: z.enum(['forever', 'until_date', 'occurrences']).optional(),
    until_date: z.string().optional(),
    occurrences_max: z.number().int().positive().optional(),
    status: z.enum(['active', 'archived', 'cancelled']).optional(),
    nag_until_done: z.boolean().optional(),
    followup_interval_hours: z.number().int().min(1).max(336).nullable().optional(),
    task_completed: z
      .boolean()
      .optional()
      .describe('Mark current cycle done; reschedules to next main occurrence (do not combine with schedule fields)'),
  },
  async (args) => {
    const t = resolveToken(args.token);
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
  'nags_delete',
  'Soft-cancel a nag (DELETE — sets status cancelled).',
  {
    nag_id: z.string().uuid(),
    token: z.string().optional(),
  },
  async ({ nag_id, token }) => {
    const t = resolveToken(token);
    if (!t) return jsonResult({ error: 'token required' }, true);
    const q = new URLSearchParams({ token: t });
    const { ok, status, data } = await fetchJson(`/api/nags/${nag_id}?${q}`, { method: 'DELETE' });
    return jsonResult(data, !ok || status >= 400);
  }
);

server.tool(
  'nag_profile_set_timezone',
  'Update user IANA timezone (recomputes active nags).',
  {
    timezone: z.string().min(1).describe('IANA zone e.g. America/New_York'),
    token: z.string().optional(),
  },
  async ({ timezone, token }) => {
    const t = resolveToken(token);
    if (!t) return jsonResult({ error: 'token required' }, true);
    const { ok, status, data } = await fetchJson('/api/nag-profile', {
      method: 'PATCH',
      body: JSON.stringify({ token: t, timezone: timezone.trim() }),
    });
    return jsonResult(data, !ok || status >= 400);
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
