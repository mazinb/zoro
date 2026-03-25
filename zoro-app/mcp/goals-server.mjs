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
const GOAL_ID_KEYS = ['save', 'home', 'invest', 'insurance', 'tax', 'retirement'];

async function loadUserDataOrNull(token) {
  if (!token) return null;
  const q = new URLSearchParams({ token });
  const { ok, status, data } = await fetchJson(`/api/user-data?${q}`, { method: 'GET' });
  if (!ok || status >= 400) return null;
  const d = data && typeof data === 'object' ? data.data : null;
  return d && typeof d === 'object' ? d : null;
}

function mergeSharedData(existingSharedData, incomingSharedData) {
  const base =
    existingSharedData && typeof existingSharedData === 'object' && !Array.isArray(existingSharedData)
      ? existingSharedData
      : {};
  const next =
    incomingSharedData && typeof incomingSharedData === 'object' && !Array.isArray(incomingSharedData)
      ? incomingSharedData
      : {};
  return { ...base, ...next };
}

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
            '- **goals.detail_goal** — same as `goals.detail`, but restricted to exactly one goal via `goal` (save/home/invest/insurance/tax/retirement).',
            '',
            '## Save-only onboarding tools (client LLM parses)',
            '',
            'We do not rely on our backend LLM to parse. The client LLM should produce structured JSON payloads that mirror the UI step order and option strings, then call these tools:',
            '',
            '- **goals.save.save_more** — `/save` (formType `save_more`).',
            '- **goals.home.save_big_purchase** — `/home` (formType `big_purchase`).',
            '- **goals.invest.save_invest** — `/invest` (formType `invest`).',
            '- **goals.insurance.save_insurance** — `/insurance` (formType `insurance`).',
            '- **goals.tax.save_tax** — `/tax` (formType `tax`).',
            '- **goals.retirement.save_retirement** — `/retire` (formType `retirement`).',
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

  server.tool(
    'goals.detail_goal',
    'Full goal answers from user_data for one goal, plus `wealth_data_filled` (for GoalDataGate).',
    {
      token: z.string().optional(),
      goal: z.enum(GOAL_ID_KEYS).describe('Goal id: save, home, invest, insurance, tax, retirement'),
    },
    {
      title: 'Goals detail (single goal)',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async ({ token, goal }, extra) => {
      const t = resolveToken(token, extra);
      if (!t) return jsonResult({ error: 'token required' }, true);
      const q = new URLSearchParams({ token: t, fields: goal });
      const { ok, status, data } = await fetchJson(`/api/goals/detail?${q}`, { method: 'GET' });
      return jsonResult(data, !ok || status >= 400);
    }
  );

  server.tool(
    'goals.save.save_more',
    'Save the Save More Consistently goal answers (client LLM must supply JSON; server does not parse).',
    {
      token: z.string().optional(),
      formData: z.object({
        currency: z.string().nullable().optional(),
        currentSurplus: z.string().nullable().optional(),
        spendingLeakage: z.string().nullable().optional(),
        emergencyBuffer: z.string().nullable().optional(),
        existingCash: z.string().nullable().optional(),
        savingFriction: z.string().nullable().optional(),
        why: z.string().nullable().optional(),
        commitment: z.string().nullable().optional(),
        additionalNotes: z.string().nullable().optional(),
      }),
    },
    {
      title: 'Save Save-More answers',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    async ({ token, formData }, extra) => {
      const t = resolveToken(token, extra);
      if (!t) return jsonResult({ error: 'token required' }, true);
      const existing = await loadUserDataOrNull(t);
      const sharedData = mergeSharedData(existing?.shared_data, {
        existingCash: formData.existingCash ?? null,
        currentSurplus: formData.currentSurplus ?? null,
        currency: formData.currency ?? null,
      });
      const { ok, status, data } = await fetchJson('/api/user-data', {
        method: 'POST',
        body: JSON.stringify({
          token: t,
          formType: 'save_more',
          formData,
          sharedData,
        }),
      });
      return jsonResult(data, !ok || status >= 400);
    }
  );

  server.tool(
    'goals.home.save_big_purchase',
    'Save the Big Purchase goal answers (client LLM must supply JSON; server does not parse).',
    {
      token: z.string().optional(),
      formData: z.object({
        currency: z.string().nullable().optional(),
        purchase: z.string().nullable().optional(),
        priceTag: z.string().nullable().optional(),
        deadline: z.string().nullable().optional().describe('YYYY-MM (from <input type=\"month\">)'),
        currentProgress: z.string().nullable().optional(),
        tradeoff: z.string().nullable().optional(),
        recurringCost: z.string().nullable().optional(),
        specificNote: z.string().nullable().optional(),
        additionalNotes: z.string().nullable().optional(),
      }),
    },
    {
      title: 'Save Big-Purchase answers',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    async ({ token, formData }, extra) => {
      const t = resolveToken(token, extra);
      if (!t) return jsonResult({ error: 'token required' }, true);
      const existing = await loadUserDataOrNull(t);
      const sharedData = mergeSharedData(existing?.shared_data, { currency: formData.currency ?? null });
      const { ok, status, data } = await fetchJson('/api/user-data', {
        method: 'POST',
        body: JSON.stringify({
          token: t,
          formType: 'big_purchase',
          formData,
          sharedData,
        }),
      });
      return jsonResult(data, !ok || status >= 400);
    }
  );

  server.tool(
    'goals.invest.save_invest',
    'Save the Invest Smarter goal answers (client LLM must supply JSON; server does not parse).',
    {
      token: z.string().optional(),
      formData: z.object({
        currency: z.string().nullable().optional(),
        investmentGoal: z.string().nullable().optional(),
        experienceLevel: z.string().nullable().optional(),
        riskTolerance: z.string().nullable().optional(),
        activeHoldings: z.string().nullable().optional().describe('\"Yes\" or \"No\"'),
        topHoldings: z.string().nullable().optional(),
        timeHorizon: z.string().nullable().optional(),
        taxSensitivity: z.string().nullable().optional(),
        contribution: z.string().nullable().optional(),
        additionalNotes: z.string().nullable().optional(),
      }),
    },
    {
      title: 'Save Invest answers',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    async ({ token, formData }, extra) => {
      const t = resolveToken(token, extra);
      if (!t) return jsonResult({ error: 'token required' }, true);
      const existing = await loadUserDataOrNull(t);
      const sharedData = mergeSharedData(existing?.shared_data, { currency: formData.currency ?? null });
      const { ok, status, data } = await fetchJson('/api/user-data', {
        method: 'POST',
        body: JSON.stringify({
          token: t,
          formType: 'invest',
          formData,
          sharedData,
        }),
      });
      return jsonResult(data, !ok || status >= 400);
    }
  );

  server.tool(
    'goals.insurance.save_insurance',
    'Save the Insurance goal answers (client LLM must supply JSON; server does not parse).',
    {
      token: z.string().optional(),
      formData: z.object({
        householdSize: z.string().nullable().optional(),
        currentStack: z.array(z.string()).optional().default([]),
        lifeInsuranceMath: z.string().nullable().optional(),
        criticalIllness: z.string().nullable().optional(),
        liabilityCheck: z.string().nullable().optional(),
        premiumPulse: z.string().nullable().optional(),
        renewal: z.string().nullable().optional(),
        additionalNotes: z.string().nullable().optional(),
      }),
    },
    {
      title: 'Save Insurance answers',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    async ({ token, formData }, extra) => {
      const t = resolveToken(token, extra);
      if (!t) return jsonResult({ error: 'token required' }, true);
      const existing = await loadUserDataOrNull(t);
      const sharedData = mergeSharedData(existing?.shared_data, { householdSize: formData.householdSize ?? null });
      const { ok, status, data } = await fetchJson('/api/user-data', {
        method: 'POST',
        body: JSON.stringify({
          token: t,
          formType: 'insurance',
          formData,
          sharedData,
        }),
      });
      return jsonResult(data, !ok || status >= 400);
    }
  );

  server.tool(
    'goals.tax.save_tax',
    'Save the Tax goal answers (client LLM must supply JSON; server does not parse).',
    {
      token: z.string().optional(),
      formData: z.object({
        currency: z.string().nullable().optional(),
        incomeSource: z.string().nullable().optional(),
        grossIncome: z.string().nullable().optional(),
        deductions: z.array(z.string()).optional().default([]),
        retirementStrategy: z.string().nullable().optional(),
        businessExpenses: z.string().nullable().optional(),
        bigSurprise: z.string().nullable().optional(),
        mainGoal: z.string().nullable().optional(),
        additionalNotes: z.string().nullable().optional(),
      }),
    },
    {
      title: 'Save Tax answers',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    async ({ token, formData }, extra) => {
      const t = resolveToken(token, extra);
      if (!t) return jsonResult({ error: 'token required' }, true);
      const existing = await loadUserDataOrNull(t);
      const sharedData = mergeSharedData(existing?.shared_data, {
        currency: formData.currency ?? null,
        grossIncome: formData.grossIncome ?? null,
      });
      const { ok, status, data } = await fetchJson('/api/user-data', {
        method: 'POST',
        body: JSON.stringify({
          token: t,
          formType: 'tax',
          formData,
          sharedData,
        }),
      });
      return jsonResult(data, !ok || status >= 400);
    }
  );

  server.tool(
    'goals.retirement.save_retirement',
    'Save the Retirement goal answers (client LLM must supply JSON; server does not parse).',
    {
      token: z.string().optional(),
      formData: z.object({
        lifestyle: z.string().nullable().optional(),
        country: z.string().optional(),
        housing: z.string().nullable().optional(),
        healthcare: z.string().nullable().optional(),
        travel: z.string().nullable().optional(),
        safety: z.string().nullable().optional(),
        liquidNetWorth: z.string().nullable().optional(),
        annualIncomeJob: z.string().nullable().optional(),
        otherIncome: z.string().nullable().optional(),
        pension: z.string().nullable().optional(),
        liabilities: z.string().nullable().optional(),
      }),
      expenseBuckets: z
        .record(z.string(), z.object({ value: z.number().optional() }))
        .optional()
        .describe('Optional retirement_expense_buckets shape; normally filled on /expenses.'),
    },
    {
      title: 'Save Retirement answers',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    async ({ token, formData, expenseBuckets }, extra) => {
      const t = resolveToken(token, extra);
      if (!t) return jsonResult({ error: 'token required' }, true);
      const existing = await loadUserDataOrNull(t);
      const sharedData = mergeSharedData(existing?.shared_data, {
        liquidNetWorth: formData.liquidNetWorth ?? null,
        annualIncomeJob: formData.annualIncomeJob ?? null,
        otherIncome: formData.otherIncome ?? null,
        country: formData.country ?? null,
      });
      const payload = {
        token: t,
        formType: 'retirement',
        formData,
        sharedData,
        ...(expenseBuckets ? { expenseBuckets } : {}),
      };
      const { ok, status, data } = await fetchJson('/api/user-data', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
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

  server.prompt(
    'goals.onboarding.save_more.payload',
    'Onboard the /save flow: produce JSON payload then call goals.save.save_more',
    {
      token: z.string().optional(),
    },
    async ({ token }) => ({
      description: 'Client-LLM parsing prompt for Save More Consistently.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'You are onboarding a user through Zoro’s “Save more consistently” goal flow (/save).',
              '',
              'CRITICAL CONTRACT',
              '- Do NOT call any server-side parse endpoints.',
              '- You MUST output JSON ONLY (no prose) that matches the tool schema.',
              '- After producing the JSON, call the tool `goals.save.save_more` with that payload.',
              '',
              'INPUTS YOU MAY ASK FOR (in UI order):',
              '1) currency (3-letter code like "USD")',
              '2) currentSurplus (numeric string, monthly) — options often used:',
              '   - "Not sure"',
              '   - "$0 — I’m breaking even"',
              '   - "$100–$500"',
              '   - "$500–$1,500"',
              '   - "$1,500+"',
              '3) spendingLeakage — choose ONE of:',
              '   - "Subscriptions and memberships"',
              '   - "Food delivery/ dining out"',
              '   - "Impulse shopping"',
              '   - "Transport costs"',
              '   - "Bills/utilities"',
              '   - "Debt payments"',
              '   - "Other"',
              '4) emergencyBuffer — choose ONE of:',
              '   - "I don’t have an emergency fund"',
              '   - "Less than 1 month of expenses"',
              '   - "1–3 months of expenses"',
              '   - "3–6 months of expenses"',
              '   - "6+ months of expenses"',
              '5) existingCash (numeric string) — total cash savings (ok to estimate)',
              '6) savingFriction — choose ONE of:',
              '   - "I forget to save"',
              '   - "Spending feels unpredictable"',
              '   - "Income varies"',
              '   - "I’m saving but not enough"',
              '   - "I don’t know how much to save"',
              '   - "Other"',
              '7) why — choose ONE of:',
              '   - "Build an emergency fund"',
              '   - "Buy something big"',
              '   - "Pay down debt"',
              '   - "Feel less stressed"',
              '   - "Invest for the future"',
              '   - "Other"',
              '8) commitment — choose ONE of:',
              '   - "Start small (easy wins)"',
              '   - "Moderate (steady progress)"',
              '   - "Aggressive (fast progress)"',
              '9) additionalNotes (free text, optional)',
              '',
              'OUTPUT JSON SHAPE (JSON ONLY):',
              '{',
              '  "token": "<optional token override>",',
              '  "formData": {',
              '    "currency": "USD" | null,',
              '    "currentSurplus": "..." | null,',
              '    "spendingLeakage": "..." | null,',
              '    "emergencyBuffer": "..." | null,',
              '    "existingCash": "..." | null,',
              '    "savingFriction": "..." | null,',
              '    "why": "..." | null,',
              '    "commitment": "..." | null,',
              '    "additionalNotes": "..." | null',
              '  }',
              '}',
              '',
              token ? `Token override to use if needed: ${token}` : 'If you have a configured token, omit "token" in the JSON.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'goals.onboarding.big_purchase.payload',
    'Onboard the /home flow: produce JSON payload then call goals.home.save_big_purchase',
    {
      token: z.string().optional(),
    },
    async ({ token }) => ({
      description: 'Client-LLM parsing prompt for Big Purchase (/home).',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'You are onboarding a user through Zoro’s “Big purchase” goal flow (/home).',
              '',
              'CRITICAL CONTRACT',
              '- Do NOT call any server-side parse endpoints.',
              '- You MUST output JSON ONLY (no prose) that matches the tool schema.',
              '- After producing the JSON, call the tool `goals.home.save_big_purchase` with that payload.',
              '',
              'FIELDS (UI order + common option strings):',
              '- currency (3-letter code like "USD")',
              '- purchase — choose ONE of:',
              '  - "Home down payment"',
              '  - "Car"',
              '  - "Wedding"',
              '  - "Travel"',
              '  - "Education"',
              '  - "Other"',
              '- priceTag (numeric string, total cost)',
              '- deadline (YYYY-MM, month input, e.g. "2027-06")',
              '- currentProgress (numeric string, how much already saved)',
              '- tradeoff — choose ONE of:',
              '  - "Cut spending"',
              '  - "Increase income"',
              '  - "Do both"',
              '  - "Not sure"',
              '- recurringCost (numeric string monthly, optional; e.g. maintenance/insurance/subscription)',
              '- specificNote (free text, optional; details like city/model/venue/etc.)',
              '- additionalNotes (free text, optional)',
              '',
              'OUTPUT JSON SHAPE (JSON ONLY):',
              '{',
              '  "token": "<optional token override>",',
              '  "formData": {',
              '    "currency": "USD" | null,',
              '    "purchase": "..." | null,',
              '    "priceTag": "..." | null,',
              '    "deadline": "YYYY-MM" | null,',
              '    "currentProgress": "..." | null,',
              '    "tradeoff": "..." | null,',
              '    "recurringCost": "..." | null,',
              '    "specificNote": "..." | null,',
              '    "additionalNotes": "..." | null',
              '  }',
              '}',
              '',
              token ? `Token override to use if needed: ${token}` : 'If you have a configured token, omit "token" in the JSON.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'goals.onboarding.invest.payload',
    'Onboard the /invest flow: produce JSON payload then call goals.invest.save_invest',
    {
      token: z.string().optional(),
    },
    async ({ token }) => ({
      description: 'Client-LLM parsing prompt for Invest Smarter (/invest).',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'You are onboarding a user through Zoro’s “Invest smarter” goal flow (/invest).',
              '',
              'CRITICAL CONTRACT',
              '- Do NOT call any server-side parse endpoints.',
              '- You MUST output JSON ONLY (no prose) that matches the tool schema.',
              '- After producing the JSON, call the tool `goals.invest.save_invest` with that payload.',
              '',
              'FIELDS (UI order + common option strings):',
              '- currency (3-letter code like "USD")',
              '- investmentGoal — choose ONE of:',
              '  - "Grow wealth"',
              '  - "Retirement"',
              '  - "Short-term goal"',
              '  - "Passive income"',
              '  - "Not sure"',
              '- experienceLevel — choose ONE of:',
              '  - "Beginner"',
              '  - "Intermediate"',
              '  - "Advanced"',
              '- riskTolerance — choose ONE of:',
              '  - "Low"',
              '  - "Medium"',
              '  - "High"',
              '- activeHoldings — "Yes" or "No"',
              '- topHoldings (free text, optional; only if activeHoldings is "Yes")',
              '- timeHorizon — choose ONE of:',
              '  - "0–2 years"',
              '  - "3–5 years"',
              '  - "6–10 years"',
              '  - "10+ years"',
              '- taxSensitivity — choose ONE of:',
              '  - "High (tax-efficient matters a lot)"',
              '  - "Medium"',
              '  - "Low"',
              '  - "Not sure"',
              '- contribution (numeric string, monthly planned contribution)',
              '- additionalNotes (free text, optional)',
              '',
              'OUTPUT JSON SHAPE (JSON ONLY):',
              '{',
              '  "token": "<optional token override>",',
              '  "formData": {',
              '    "currency": "USD" | null,',
              '    "investmentGoal": "..." | null,',
              '    "experienceLevel": "..." | null,',
              '    "riskTolerance": "..." | null,',
              '    "activeHoldings": "Yes" | "No" | null,',
              '    "topHoldings": "..." | null,',
              '    "timeHorizon": "..." | null,',
              '    "taxSensitivity": "..." | null,',
              '    "contribution": "..." | null,',
              '    "additionalNotes": "..." | null',
              '  }',
              '}',
              '',
              token ? `Token override to use if needed: ${token}` : 'If you have a configured token, omit "token" in the JSON.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'goals.onboarding.insurance.payload',
    'Onboard the /insurance flow: produce JSON payload then call goals.insurance.save_insurance',
    {
      token: z.string().optional(),
    },
    async ({ token }) => ({
      description: 'Client-LLM parsing prompt for Insurance (/insurance).',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'You are onboarding a user through Zoro’s “Insurance” goal flow (/insurance).',
              '',
              'CRITICAL CONTRACT',
              '- Do NOT call any server-side parse endpoints.',
              '- You MUST output JSON ONLY (no prose) that matches the tool schema.',
              '- After producing the JSON, call the tool `goals.insurance.save_insurance` with that payload.',
              '',
              'FIELDS (UI order + option strings):',
              '- householdSize (numeric string, e.g. "1", "2", "4")',
              '- currentStack (array of strings; checklist). Common items:',
              '  - "Health insurance"',
              '  - "Life insurance"',
              '  - "Disability insurance"',
              '  - "Critical illness insurance"',
              '  - "Home/renters insurance"',
              '  - "Auto insurance"',
              '  - "Liability/umbrella insurance"',
              '- lifeInsuranceMath — choose ONE of: "3", "5", "10", "20" (years of coverage to target)',
              '- criticalIllness — choose ONE of:',
              '  - "Yes"',
              '  - "No"',
              '  - "I think my job covers it"',
              '- liabilityCheck — choose ONE of: "Yes", "No"',
              '- premiumPulse — choose ONE of:',
              '  - "I’m overpaying"',
              '  - "Seems about right"',
              '  - "I’m underinsured"',
              '  - "Not sure"',
              '- renewal — choose ONE of:',
              '  - "I review every year"',
              '  - "Only when it renews"',
              '  - "Rarely/never"',
              '- additionalNotes (free text, optional)',
              '',
              'OUTPUT JSON SHAPE (JSON ONLY):',
              '{',
              '  "token": "<optional token override>",',
              '  "formData": {',
              '    "householdSize": "..." | null,',
              '    "currentStack": ["..."],',
              '    "lifeInsuranceMath": "3" | "5" | "10" | "20" | null,',
              '    "criticalIllness": "..." | null,',
              '    "liabilityCheck": "Yes" | "No" | null,',
              '    "premiumPulse": "..." | null,',
              '    "renewal": "..." | null,',
              '    "additionalNotes": "..." | null',
              '  }',
              '}',
              '',
              token ? `Token override to use if needed: ${token}` : 'If you have a configured token, omit "token" in the JSON.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'goals.onboarding.tax.payload',
    'Onboard the /tax flow: produce JSON payload then call goals.tax.save_tax',
    {
      token: z.string().optional(),
    },
    async ({ token }) => ({
      description: 'Client-LLM parsing prompt for Tax (/tax).',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'You are onboarding a user through Zoro’s “Tax” goal flow (/tax).',
              '',
              'CRITICAL CONTRACT',
              '- Do NOT call any server-side parse endpoints.',
              '- You MUST output JSON ONLY (no prose) that matches the tool schema.',
              '- After producing the JSON, call the tool `goals.tax.save_tax` with that payload.',
              '',
              'FIELDS (UI order + option strings):',
              '- currency (3-letter code like "USD")',
              '- incomeSource — choose ONE of:',
              '  - "W-2 employee"',
              '  - "Self-employed/contractor"',
              '  - "Both"',
              '  - "Other"',
              '- grossIncome (numeric string, annual)',
              '- deductions (array of strings; checklist). Common items:',
              '  - "Standard deduction"',
              '  - "Mortgage interest"',
              '  - "Charitable giving"',
              '  - "Student loan interest"',
              '  - "Medical expenses"',
              '  - "Education credits"',
              '  - "Child/dependent credits"',
              '  - "Business expenses"',
              '  - "Not sure"',
              '- retirementStrategy — choose ONE of: "Yes", "No", "Not sure"',
              '- businessExpenses (free text, optional; especially if self-employed)',
              '- bigSurprise (free text, optional; what was surprising last year)',
              '- mainGoal (free text or concise choice like "pay less", "avoid surprises", "plan quarterly")',
              '- additionalNotes (free text, optional)',
              '',
              'OUTPUT JSON SHAPE (JSON ONLY):',
              '{',
              '  "token": "<optional token override>",',
              '  "formData": {',
              '    "currency": "USD" | null,',
              '    "incomeSource": "..." | null,',
              '    "grossIncome": "..." | null,',
              '    "deductions": ["..."],',
              '    "retirementStrategy": "Yes" | "No" | "Not sure" | null,',
              '    "businessExpenses": "..." | null,',
              '    "bigSurprise": "..." | null,',
              '    "mainGoal": "..." | null,',
              '    "additionalNotes": "..." | null',
              '  }',
              '}',
              '',
              token ? `Token override to use if needed: ${token}` : 'If you have a configured token, omit "token" in the JSON.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'goals.onboarding.retirement.payload',
    'Onboard the /retire flow: produce JSON payload then call goals.retirement.save_retirement',
    {
      token: z.string().optional(),
    },
    async ({ token }) => ({
      description: 'Client-LLM parsing prompt for Retirement (/retire).',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'You are onboarding a user through Zoro’s “Retirement” goal flow (/retire).',
              '',
              'CRITICAL CONTRACT',
              '- Do NOT call any server-side parse endpoints.',
              '- You MUST output JSON ONLY (no prose) that matches the tool schema.',
              '- After producing the JSON, call the tool `goals.retirement.save_retirement` with that payload.',
              '',
              'FIELDS (UI order):',
              '- lifestyle (free text; e.g., "comfortable", "minimal", "luxury")',
              '- country (required; free text like "United States" or ISO-ish like "US")',
              '- housing (free text; e.g., "own home paid off", "rent", "downsizing")',
              '- healthcare (free text; priorities/cost expectations)',
              '- travel (free text; frequency/budget expectations)',
              '- safety (free text; risk tolerance / location priorities)',
              '- liquidNetWorth (numeric string; liquid assets only)',
              '- annualIncomeJob (numeric string; current job income)',
              '- otherIncome (numeric string; rental/dividends/side income)',
              '- pension (numeric string; expected pension, if any)',
              '- liabilities (numeric string; total liabilities, if any)',
              '',
              'OPTIONAL:',
              '- expenseBuckets: only include if user explicitly provides the retirement expense bucket totals. Otherwise omit.',
              '',
              'OUTPUT JSON SHAPE (JSON ONLY):',
              '{',
              '  "token": "<optional token override>",',
              '  "formData": {',
              '    "lifestyle": "..." | null,',
              '    "country": "...",',
              '    "housing": "..." | null,',
              '    "healthcare": "..." | null,',
              '    "travel": "..." | null,',
              '    "safety": "..." | null,',
              '    "liquidNetWorth": "..." | null,',
              '    "annualIncomeJob": "..." | null,',
              '    "otherIncome": "..." | null,',
              '    "pension": "..." | null,',
              '    "liabilities": "..." | null',
              '  },',
              '  "expenseBuckets": { "bucket_key": { "value": 1234 } }',
              '}',
              '',
              token ? `Token override to use if needed: ${token}` : 'If you have a configured token, omit "token" in the JSON.',
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
