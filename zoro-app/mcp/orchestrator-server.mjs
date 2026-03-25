#!/usr/bin/env node
/**
 * Zoro Orchestrator MCP — prompt-first router + lightweight status + onboarding.
 * Env: NAG_MCP_BASE_URL, NAG_MCP_TOKEN (same as zoro-nags).
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

function resolveOrigin(fallback) {
  return (
    process.env.NAG_MCP_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    fallback
  ).replace(/\/$/, '');
}

const base = resolveOrigin('http://localhost:3000');

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

  const publicOrigin = resolveOrigin('https://www.getzoro.com');

  function registerToolWithAliases(toolName, aliases, description, schema, hints, handler) {
    server.tool(toolName, description, schema, hints, handler);
    for (const alias of aliases) server.tool(alias, description, schema, hints, handler);
  }

  server.resource(
    'orchestrator_guide',
    'zoro://orchestrator/docs',
    { description: 'How orchestrator is used', mimeType: 'text/markdown' },
    async () => ({
      contents: [
        {
          uri: 'zoro://orchestrator/docs',
          mimeType: 'text/markdown',
          text: [
            '# Zoro Orchestrator MCP',
            '',
            'Prompt-first router for choosing the next MCP (Wealth vs Goals).',
            '',
            'Rules:',
            '- Orchestrator never calls Nags directly.',
            '- Switch to Wealth/Goals for actual work; switch to Nags only if user explicitly wants reminder scheduling.',
            '',
            'Docs:',
            '- `zoro-app/docs/orchestrator-smithery.md` (Smithery description)',
          ].join('\n'),
        },
      ],
    })
  );

  registerToolWithAliases(
    'orchestrator.server_catalog',
    ['orchestrator_server_catalog'],
    'Return MCP endpoints and recommended server keys.',
    {},
    {
      title: 'MCP server catalog',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async () =>
      jsonResult({
        success: true,
        origin: publicOrigin,
        mcp: {
          orchestrator: { key: 'zoro-orchestrator', url: `${publicOrigin}/api/mcp/orchestrator` },
          goals: { key: 'zoro-goals', url: `${publicOrigin}/api/mcp/goals` },
          wealth: { key: 'zoro-wealth', url: `${publicOrigin}/api/mcp/wealth` },
          nags: { key: 'zoro-nags', url: `${publicOrigin}/api/mcp/nags` },
        },
        notes: [
          'Each MCP is a different URL.',
          'Orchestrator routes to Wealth/Goals; it does not call Nags directly.',
        ],
      })
  );

  registerToolWithAliases(
    'orchestrator.landing_routes',
    ['orchestrator_landing_routes'],
    'Public no-token routes to start the experience.',
    {},
    {
      title: 'Landing routes',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async () =>
      jsonResult({
        success: true,
        token_required: false,
        routes: {
          nag: '/nag',
          nag_developer: '/nag/developer',
          wealth: '/wealth',
          goals: '/goals',
          expenses: '/expenses',
          income: '/income',
          assets: '/assets',
          save: '/save',
          home: '/home',
          invest: '/invest',
          insurance: '/insurance',
          tax: '/tax',
          retire: '/retire',
        },
        notes: [
          'Start on public landing routes without token.',
          'Use orchestrator.send_magic_link (with confirm_send=true) only with user consent.',
          'orchestrator.summary requires token.',
        ],
      })
  );

  registerToolWithAliases(
    'orchestrator.summary',
    ['orchestrator_summary'],
    'Cross-domain snapshot: which goals/wealth areas have data + tokenized deep links.',
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

  registerToolWithAliases(
    'orchestrator.send_magic_link',
    ['orchestrator_send_magic_link'],
    'Send magic link email so the user can open a path with their token (uses /api/auth/send-magic-link).',
    {
      email: z.string().email(),
      redirectPath: z
        .string()
        .describe('App path e.g. /wealth, /goals, /expenses, /save'),
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

  server.prompt(
    'start_here',
    'Route the user to the right MCP server',
    {
      goal: z.string().min(1).describe('What the user wants to do'),
      has_token: z.boolean().optional().describe('Whether a user token is already available'),
    },
    async ({ goal, has_token }) => ({
      description: 'Decide whether to use orchestrator tools or switch to zoro-wealth/zoro-goals.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              `User request: ${goal}`,
              `Token available: ${has_token === true ? 'yes' : 'no/unknown'}.`,
              'Decide next step:',
              '- If token is missing, use orchestrator.landing_routes and (with consent) orchestrator.send_magic_link.',
              '- If token exists, use orchestrator.summary if you need a cross-domain snapshot.',
              '- Route wealth intent to zoro-wealth; route goal intent to zoro-goals.',
              '- Do not call zoro-nags unless the user explicitly wants reminder scheduling.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'onboarding_email_link',
    'Onboard user and send access link by email',
    {
      email: z.string().email().describe('User email'),
      redirectPath: z.string().optional().describe('Destination route (defaults to /nag)'),
      confirm_send: z.boolean().optional().describe('Must be true to actually send'),
    },
    async ({ email, redirectPath, confirm_send }) => ({
      description: 'Consent-first magic link delivery.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              `Help onboard this user by email: ${email}.`,
              `Preferred redirect path: ${redirectPath || '/nag'}.`,
              `Consent to send now: ${confirm_send === true ? 'yes' : 'not confirmed yet'}.`,
              'Flow:',
              '1) Call orchestrator.landing_routes.',
              '2) If consent is true, call orchestrator.send_magic_link with confirm_send=true.',
              '3) If consent is not true, do not send.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'review_progress',
    'Summarize wealth and goals progress',
    {
      token: z.string().optional().describe('users.verification_token'),
    },
    async ({ token }) => ({
      description: 'Generate a concise progress review from orchestrator summary.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              token ? `Use this token override: ${token}` : 'Use configured token header/env.',
              'Call orchestrator.summary and return:',
              '- completed vs missing areas',
              '- suggested next page path',
              '- next MCP server to use (zoro-wealth or zoro-goals)',
              '- 1-2 suggested next actions (do not schedule nags unless user asked).',
            ].join('\n'),
          },
        },
      ],
    })
  );

  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = createOrchestratorMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
