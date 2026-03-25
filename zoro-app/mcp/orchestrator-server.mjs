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
            '- **orchestrator.landing_routes** — public, no-token start links for onboarding and discovery.',
            '- **orchestrator.summary** — goals progress flags, wealth flags, counts, deep-link paths with token.',
            '- **orchestrator.goals_detail** — `user_data` slices per goal (save/home/invest/insurance/tax/retirement) + wealth filled flags.',
            '- **orchestrator.send_magic_link** — email the user a link with `?token=` for a path (e.g. /expenses, /retire). Requires confirm_send=true.',
          ].join('\n'),
        },
      ],
    })
  );

  server.tool(
    'orchestrator.landing_routes',
    'Public no-token routes to start the experience. Use send_magic_link only when access to user data is needed.',
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
          'Use orchestrator.send_magic_link to deliver tokenized links only when personalized data/actions are needed.',
          'orchestrator.summary and orchestrator.goals_detail require token.',
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

  server.prompt(
    'orchestrator.start_here',
    'Choose the right orchestrator tool for user intent',
    {
      goal: z.string().min(1).describe('What the user wants to do'),
      has_token: z.boolean().optional().describe('Whether a user token is already available'),
    },
    async ({ goal, has_token }) => ({
      description: 'Route user intent to landing_routes, summary/goals_detail, or send_magic_link.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              `User request: ${goal}`,
              `Token available: ${has_token === true ? 'yes' : 'no/unknown'}.`,
              'Flow:',
              '1) If token is missing or unknown, call orchestrator.landing_routes first.',
              '2) If user needs personalized status, call orchestrator.summary.',
              '3) If user specifically needs full goal form payloads, call orchestrator.goals_detail.',
              '4) If the user needs account access, ask consent and call orchestrator.send_magic_link with confirm_send=true.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'orchestrator.onboarding_email_link',
    'Onboard user and send access link by email',
    {
      email: z.string().email().describe('User email'),
      redirectPath: z.string().optional().describe('Destination route (defaults to /nag)'),
      confirm_send: z.boolean().optional().describe('Must be true to actually send'),
    },
    async ({ email, redirectPath, confirm_send }) => ({
      description: 'Consent-first email onboarding with magic link delivery.',
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
              '1) Call orchestrator.landing_routes for no-token public routes.',
              '2) If consent is true, call orchestrator.send_magic_link with confirm_send=true.',
              '3) If consent is not true, do not send. Ask for explicit approval first.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'orchestrator.review_progress',
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
              '- 1-2 recommended reminders to keep momentum.',
              'If user asks for deep goal JSON, call orchestrator.goals_detail next.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'orchestrator.goal_data_drilldown',
    'Fetch detailed goal payloads for selected forms',
    {
      token: z.string().optional(),
      fields: z.string().optional().describe('Comma-separated goal fields (save,home,invest,insurance,tax,retirement)'),
    },
    async ({ token, fields }) => ({
      description: 'Run goals detail query from orchestrator and format actionable next steps.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              token ? `Use this token override: ${token}` : 'Use configured token header/env.',
              `Requested goal fields: ${fields || 'all'}.`,
              'Call orchestrator.goals_detail and summarize what is filled vs missing.',
              'If user also asks wealth-only analytics, route to zoro-wealth tools.',
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
