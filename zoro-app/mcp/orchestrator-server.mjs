#!/usr/bin/env node
/**
 * Zoro Orchestrator MCP — cross-domain summary + magic link email.
 * Env: NAG_MCP_BASE_URL, NAG_MCP_TOKEN (same as zoro-nags).
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
  const headers = extra?.requestInfo?.headers ?? {};
  const headerTokenRaw = getHeaderValue(headers, [
    'x-nag-mcp-token',
    'X-NAG-MCP-TOKEN',
    'x-nag-token',
    'X-NAG-TOKEN',
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

export function createOrchestratorMcpServer() {
  const server = new McpServer({
    name: 'zoro-orchestrator',
    version: '1.0.0',
  });

  server.resource(
    'orchestrator_guide',
    'zoro://orchestrator/docs',
    { description: 'Orchestrator tools', mimeType: 'text/markdown' },
    async () => ({
      contents: [
        {
          uri: 'zoro://orchestrator/docs',
          mimeType: 'text/markdown',
          text: [
            '# Zoro Orchestrator MCP',
            '',
            '- **orchestrator.summary** — goals progress flags, wealth flags, counts, deep-link paths with token.',
            '- **orchestrator.goals_detail** — `user_data` slices per goal (save/home/invest/insurance/tax/retirement) + wealth filled flags.',
            '- **orchestrator.send_magic_link** — email the user a link with `?token=` for a path (e.g. /expenses, /retire). Requires confirm_send=true.',
          ].join('\n'),
        },
      ],
    })
  );

  server.tool(
    'orchestrator.summary',
    'Cross-domain snapshot: which goals/wealth areas have data, nag/reminder counts, canonical URLs with token.',
    {
      token: z.string().optional().describe('users.verification_token'),
    },
    {
      title: 'Orchestrator summary',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async ({ token }, extra) => {
      const t = resolveToken(token, extra);
      if (!t) return jsonResult({ error: 'token required' }, true);
      const q = new URLSearchParams({ token: t });
      const { ok, status, data } = await fetchJson(`/api/orchestrator/summary?${q}`, { method: 'GET' });
      return jsonResult(data, !ok || status >= 400);
    }
  );

  server.tool(
    'orchestrator.goals_detail',
    'Fetch goal form JSON from user_data (optional fields= save,home,invest,insurance,tax,retirement comma list; omit for all). Includes wealth_data_filled for GoalDataGate.',
    {
      token: z.string().optional(),
      fields: z
        .string()
        .optional()
        .describe('Comma-separated: save,home,invest,insurance,tax,retirement'),
    },
    {
      title: 'Goals detail',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async ({ token, fields }, extra) => {
      const t = resolveToken(token, extra);
      if (!t) return jsonResult({ error: 'token required' }, true);
      const q = new URLSearchParams({ token: t });
      if (fields?.trim()) q.set('fields', fields.trim());
      const { ok, status, data } = await fetchJson(`/api/goals/detail?${q}`, { method: 'GET' });
      return jsonResult(data, !ok || status >= 400);
    }
  );

  server.tool(
    'orchestrator.send_magic_link',
    'Send magic link email so the user can open a path with their token (uses /api/auth/send-magic-link).',
    {
      email: z.string().email(),
      redirectPath: z
        .string()
        .describe('App path e.g. /expenses, /income, /assets, /retire, /nag'),
      confirm_send: z.boolean().optional().describe('Must be true to send email'),
    },
    {
      title: 'Send magic link email',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ email, redirectPath, confirm_send }) => {
      if (confirm_send !== true) {
        return jsonResult(
          { error: 'User consent required: set confirm_send=true to send the email.' },
          true
        );
      }
      const body = {
        email: email.trim().toLowerCase(),
        redirectPath: redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`,
      };
      const { ok, status, data } = await fetchJson('/api/auth/send-magic-link', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return jsonResult(data, !ok || status >= 400);
    }
  );

  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = createOrchestratorMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
