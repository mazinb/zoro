#!/usr/bin/env node
/**
 * Zoro Goals MCP (stdio) — six main-site goal flows (/save, /home, /invest, …).
 * HTTP: /api/mcp/goals (same env as zoro-nags).
 */

import { config } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { resolveMcpToken as resolveToken } from './resolve-token.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });
config({ path: join(__dirname, '..', '.env') });

const base = (
  process.env.NAG_MCP_BASE_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
  'http://localhost:3000'
).replace(/\/$/, '');

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

const GOAL_PATH_KEYS = ['save', 'home_big_purchase', 'invest', 'insurance', 'tax', 'retire'];

export function createGoalsMcpServer() {
  const server = new McpServer({
    name: 'zoro-goals',
    version: '1.0.0',
  });

  server.resource(
    'goals_guide',
    'zoro://goals/docs',
    { description: 'Goals MCP (six flows)', mimeType: 'text/markdown' },
    async () => ({
      contents: [
        {
          uri: 'zoro://goals/docs',
          mimeType: 'text/markdown',
          text: [
            '# Zoro Goals MCP',
            '',
            '- **goals.overview** — boolean flags per goal + deep links (`/save`, `/home`, `/invest`, `/insurance`, `/tax`, `/retire`).',
            '- **goals.detail** — full `user_data` JSON per goal + `wealth_data_filled` (for GoalDataGate).',
            '',
            'Auth: `users.verification_token` via tool arg, `NAG_MCP_TOKEN`, or HTTP header `token` (or Bearer / legacy x-nag-mcp-token).',
          ].join('\n'),
        },
      ],
    })
  );

  server.tool(
    'goals.overview',
    'Light snapshot: which goal forms have data + tokenized URLs (from orchestrator summary).',
    {
      token: z.string().optional(),
    },
    {
      title: 'Goals overview',
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
      if (!ok || status >= 400) return jsonResult(data, true);
      const inner = data?.data;
      if (!inner) return jsonResult(data, false);
      const paths = inner.paths || {};
      const slimPaths = Object.fromEntries(
        GOAL_PATH_KEYS.filter((k) => paths[k] != null).map((k) => [k, paths[k]])
      );
      return jsonResult({
        success: true,
        data: {
          user: inner.user,
          goals: inner.goals,
          paths: slimPaths,
        },
      });
    }
  );

  server.tool(
    'goals.detail',
    'Full goal answers from user_data (optional fields= save,home,invest,insurance,tax,retirement; omit=all).',
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

  server.prompt(
    'goals.quick_overview',
    'Get goal completion snapshot and links',
    {
      token: z.string().optional(),
    },
    async ({ token }) => ({
      description: 'Fetch goal overview for fast progress visibility.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              token ? `Use this token override: ${token}` : 'Use configured token header/env.',
              'Call goals.overview and summarize complete vs incomplete goal areas.',
              'If user asks wealth+goals combined strategy, route to zoro-orchestrator.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'goals.fetch_detail',
    'Get full goal-form payloads',
    {
      token: z.string().optional(),
      fields: z.string().optional().describe('Comma-separated: save,home,invest,insurance,tax,retirement'),
    },
    async ({ token, fields }) => ({
      description: 'Fetch goal detail payloads and map missing sections.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              token ? `Use this token override: ${token}` : 'Use configured token header/env.',
              `Fields requested: ${fields || 'all'}.`,
              'Call goals.detail and identify what data is missing for completion.',
              'If request includes reminders or onboarding links, route to zoro-orchestrator or zoro-nags.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = createGoalsMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
