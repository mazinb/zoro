#!/usr/bin/env node
/**
 * Zoro Wealth MCP (stdio) — proxies /expenses, /income, /assets HTTP APIs.
 * Same env as nag-server: NAG_MCP_BASE_URL, NAG_MCP_TOKEN, x-nag-mcp-token headers.
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

export function createWealthMcpServer() {
  const server = new McpServer({
    name: 'zoro-wealth',
    version: '1.0.0',
  });

  server.resource(
    'wealth_api_reference',
    'zoro://wealth/docs/api',
    { description: 'Wealth routes: /expenses, /income, /assets', mimeType: 'text/markdown' },
    async () => ({
      contents: [
        {
          uri: 'zoro://wealth/docs/api',
          mimeType: 'text/markdown',
          text: [
            '# Zoro Wealth MCP',
            '',
            '- Three wealth routes: **`/expenses`**, **`/income`**, **`/assets`** (this MCP wraps their APIs + shared `user_data`).',
            '- Auth: same token as Nags (`users.verification_token`) via tool arg, `NAG_MCP_TOKEN`, or `x-nag-mcp-token`.',
            '- **wealth.user_data** — full `user_data` row (income_answers, assets_answers, goal columns).',
            '- **wealth.expenses_monthly** — monthly bucket totals.',
            '- **wealth.expenses_estimates** — saved estimates.',
            '- **wealth.currency_rates** / **wealth.currency_coverage** — FX and gaps.',
            '',
            'Income/assets structured fields live in `user_data`; expenses also use `monthly_expenses` and `expense_estimates` tables.',
          ].join('\n'),
        },
      ],
    })
  );

  server.tool(
    'wealth.user_data',
    'Load user_data for the authenticated user (income_answers, assets_answers, expenses-related fields, goals).',
    {
      token: z.string().optional().describe('verification_token or user_data.user_token'),
    },
    {
      title: 'Get user_data',
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
    'wealth.expenses_monthly',
    'Get monthly expense buckets for a month (YYYY-MM-01) or list months.',
    {
      token: z.string().optional(),
      month: z.string().optional().describe('Month key e.g. 2025-03-01; omit to list stored months'),
    },
    {
      title: 'Monthly expenses',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async ({ token, month }, extra) => {
      const t = resolveToken(token, extra);
      if (!t) return jsonResult({ error: 'token required' }, true);
      const q = new URLSearchParams({ token: t });
      if (month?.trim()) q.set('month', month.trim());
      const { ok, status, data } = await fetchJson(`/api/expenses/monthly?${q}`, { method: 'GET' });
      return jsonResult(data, !ok || status >= 400);
    }
  );

  server.tool(
    'wealth.expenses_estimates',
    'List expense estimate snapshots (or latest only with latest=true).',
    {
      token: z.string().optional(),
      latest: z.boolean().optional().describe('If true, returns only the most recent snapshot'),
    },
    {
      title: 'Expense estimates',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async ({ token, latest }, extra) => {
      const t = resolveToken(token, extra);
      if (!t) return jsonResult({ error: 'token required' }, true);
      const q = new URLSearchParams({ token: t });
      if (latest) q.set('latest', '1');
      const { ok, status, data } = await fetchJson(`/api/expenses/estimates?${q}`, { method: 'GET' });
      return jsonResult(data, !ok || status >= 400);
    }
  );

  server.tool(
    'wealth.currency_rates',
    'List stored FX rates (optional month=YYYY-MM per /api/currency-rates).',
    {
      month: z.string().optional().describe('YYYY-MM for one month; omit for rolling window'),
    },
    {
      title: 'Currency rates',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async ({ month }) => {
      const q = new URLSearchParams();
      if (month?.trim()) q.set('month', month.trim());
      const qs = q.toString();
      const { ok, status, data } = await fetchJson(`/api/currency-rates${qs ? `?${qs}` : ''}`, {
        method: 'GET',
      });
      return jsonResult(data, !ok || status >= 400);
    }
  );

  server.tool(
    'wealth.currency_coverage',
    'Report missing (month, currency) pairs for the user (expenses/income/assets currencies vs rates table).',
    {
      token: z.string().optional(),
    },
    {
      title: 'Currency coverage gaps',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async ({ token }, extra) => {
      const t = resolveToken(token, extra);
      if (!t) return jsonResult({ error: 'token required' }, true);
      const q = new URLSearchParams({ token: t });
      const { ok, status, data } = await fetchJson(`/api/currency-rates/coverage?${q}`, { method: 'GET' });
      return jsonResult(data, !ok || status >= 400);
    }
  );

  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = createWealthMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
