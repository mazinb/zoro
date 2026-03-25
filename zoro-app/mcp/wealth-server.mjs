#!/usr/bin/env node
/**
 * Zoro Wealth MCP (stdio) — proxies /expenses, /income, /assets HTTP APIs.
 * Same env as nag-server: NAG_MCP_BASE_URL, NAG_MCP_TOKEN; header `token` (or Bearer / legacy x-nag-mcp-token).
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

const EXPENSE_BUCKET_KEYS = [
  'housing',
  'food',
  'transportation',
  'healthcare',
  'entertainment',
  'other',
  'one_time',
  'travel',
];

function normalizeMonthKey(v) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return null;
  // UI uses YYYY-MM; accept YYYY-MM or YYYY-MM-01 and normalize to YYYY-MM.
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  const m = /^(\d{4}-\d{2})-\d{2}$/.exec(s);
  return m ? m[1] : null;
}

function bucketsNumberToValueObject(buckets) {
  const out = {};
  const obj = buckets && typeof buckets === 'object' ? buckets : {};
  for (const k of EXPENSE_BUCKET_KEYS) {
    const v = obj[k];
    const n = typeof v === 'number' && !Number.isNaN(v) ? v : 0;
    out[k] = { value: n };
  }
  return out;
}

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
            '- Auth: same token as Nags (`users.verification_token`) via tool arg, env `NAG_MCP_TOKEN`, or HTTP header `token` (or Bearer / legacy x-nag-mcp-token).',
            '- **data.user_data** — full `user_data` row (income_answers, assets_answers, goal columns).',
            '- **expenses.monthly** — monthly bucket totals.',
            '- **expenses.estimates** — saved estimates.',
            '- **other.currency_rates** / **other.currency_coverage** — FX and gaps.',
            '',
            '## Save-only onboarding tools (client LLM parses)',
            '',
            'We do not rely on our backend LLM to parse documents. The client LLM should produce structured JSON payloads that match the UI flows, then call these tools:',
            '',
            '- **expenses.set_estimates** — save expense estimates + country.',
            '- **expenses.save_monthly_actuals_totals** — save month totals (category totals only) and optionally tag an account name.',
            '- **income.save** — save yearly income map + selected country.',
            '- **asset.save** — save assets/liabilities + optional snapshots + selected country.',
            '- **other.reminders.create/list/delete** — lightweight recurring reminders (same as “Add reminder” widget).',
            '',
            'Income/assets structured fields live in `user_data`; expenses also use `monthly_expenses` and `expense_estimates` tables.',
          ].join('\n'),
        },
      ],
    })
  );

  server.tool(
    'data.user_data',
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
    'expenses.monthly',
    'Get monthly expense buckets for a month (YYYY-MM) or list months.',
    {
      token: z.string().optional(),
      month: z.string().optional().describe('Month key e.g. 2025-03; omit to list stored months'),
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
    'expenses.set_estimates',
    'Save expense estimate buckets (UI step 0). Client LLM must supply totals; server does not parse.',
    {
      token: z.string().optional(),
      expenses_country: z.string().min(1).describe('Country key used by UI currency selector (e.g. "India", "US")'),
      buckets: z
        .object({
          housing: z.number().nonnegative(),
          food: z.number().nonnegative(),
          transportation: z.number().nonnegative(),
          healthcare: z.number().nonnegative(),
          entertainment: z.number().nonnegative(),
          other: z.number().nonnegative(),
          one_time: z.number().nonnegative(),
          travel: z.number().nonnegative(),
        })
        .describe('Category totals (numbers).'),
      compared_to_actuals: z
        .boolean()
        .optional()
        .describe('If true, marks estimate snapshot as compared to actuals in history (like CompareView save).'),
    },
    {
      title: 'Set expense estimates',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    async ({ token, expenses_country, buckets, compared_to_actuals }, extra) => {
      const t = resolveToken(token, extra);
      if (!t) return jsonResult({ error: 'token required' }, true);

      const existing = await loadUserDataOrNull(t);
      const mergedShared = mergeSharedData(existing?.shared_data, { expenses_country: expenses_country.trim() });

      const expenseBuckets = bucketsNumberToValueObject(buckets);

      const saveUserData = await fetchJson('/api/user-data', {
        method: 'POST',
        body: JSON.stringify({
          token: t,
          formType: 'expenses',
          expenseBuckets,
          sharedData: mergedShared,
        }),
      });

      const saveEstimateSnapshot = await fetchJson('/api/expenses/estimates', {
        method: 'POST',
        body: JSON.stringify({
          token: t,
          buckets: bucketsNumberToValueObject(buckets),
          comparedToActuals: compared_to_actuals === true,
        }),
      });

      const ok = saveUserData.ok && saveEstimateSnapshot.ok;
      return jsonResult(
        {
          success: ok,
          user_data: saveUserData.data,
          estimates: saveEstimateSnapshot.data,
        },
        !ok
      );
    }
  );

  server.tool(
    'expenses.save_monthly_actuals_totals',
    'Save a month’s actual expense totals (category totals only). Client LLM must compute totals; server does not parse.',
    {
      token: z.string().optional(),
      month: z.string().describe('Month key YYYY-MM (or YYYY-MM-01; will normalize to YYYY-MM)'),
      buckets: z.object({
        housing: z.number().nonnegative(),
        food: z.number().nonnegative(),
        transportation: z.number().nonnegative(),
        healthcare: z.number().nonnegative(),
        entertainment: z.number().nonnegative(),
        other: z.number().nonnegative(),
        one_time: z.number().nonnegative(),
        travel: z.number().nonnegative(),
      }),
      import_account_name: z
        .string()
        .optional()
        .describe('Optional label shown as an “Account” in the expenses UI (stored in shared_data.expense_accounts).'),
    },
    {
      title: 'Save monthly expense totals',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    async ({ token, month, buckets, import_account_name }, extra) => {
      const t = resolveToken(token, extra);
      if (!t) return jsonResult({ error: 'token required' }, true);

      const mm = normalizeMonthKey(month);
      if (!mm) return jsonResult({ error: 'month must be YYYY-MM (or YYYY-MM-01)' }, true);

      const saveMonthly = await fetchJson('/api/expenses/monthly', {
        method: 'POST',
        body: JSON.stringify({
          token: t,
          month: mm,
          buckets: bucketsNumberToValueObject(buckets),
          finalizeImport: true,
        }),
      });

      let sharedDataUpdate = null;
      const acct = typeof import_account_name === 'string' ? import_account_name.trim() : '';
      if (acct) {
        const existing = await loadUserDataOrNull(t);
        const existingShared = existing?.shared_data;
        const existingAccounts = Array.isArray(existingShared?.expense_accounts) ? existingShared.expense_accounts : [];
        const nextAccounts = [...existingAccounts];
        if (!nextAccounts.some((a) => a && typeof a === 'object' && a.name === acct)) {
          nextAccounts.push({ name: acct, type: 'expense' });
        }
        const mergedShared = mergeSharedData(existingShared, { expense_accounts: nextAccounts });
        sharedDataUpdate = await fetchJson('/api/user-data', {
          method: 'POST',
          body: JSON.stringify({
            token: t,
            formType: 'expenses',
            sharedData: mergedShared,
          }),
        });
      }

      const ok = saveMonthly.ok && (!sharedDataUpdate || sharedDataUpdate.ok);
      return jsonResult(
        {
          success: ok,
          month: mm,
          monthly: saveMonthly.data,
          shared_data_update: sharedDataUpdate ? sharedDataUpdate.data : null,
        },
        !ok
      );
    }
  );

  server.tool(
    'expenses.estimates',
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
    'income.save',
    'Save income answers (UI: Income details). Client LLM must supply values; server does not parse.',
    {
      token: z.string().optional(),
      income_country: z.string().min(1).describe('Country key used by UI currency selector (e.g. "India", "US")'),
      active_year: z.string().regex(/^\d{4}$/).describe('The year user is editing/targeting (YYYY)'),
      yearly: z
        .record(
          z.string().regex(/^\d{4}$/),
          z.object({
            job: z.string().optional(),
            baseSalary: z.number().optional(),
            bonus: z.number().optional(),
            bonusPct: z.number().min(0).max(100).optional(),
            rsuValue: z.number().optional(),
            rsuCurrency: z.string().optional(),
            effectiveTaxRate: z.number().min(0).max(100).optional(),
            currency: z.string().optional(),
          })
        )
        .describe('Map of year -> income fields. Numbers should be annual amounts.'),
    },
    {
      title: 'Save income answers',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    async ({ token, income_country, active_year, yearly }, extra) => {
      const t = resolveToken(token, extra);
      if (!t) return jsonResult({ error: 'token required' }, true);

      const existing = await loadUserDataOrNull(t);
      const mergedShared = mergeSharedData(existing?.shared_data, { income_country: income_country.trim() });

      const selected = yearly?.[active_year] ?? {};
      const topLevel = {
        job: typeof selected.job === 'string' ? selected.job.trim() : '',
        baseSalary: typeof selected.baseSalary === 'number' ? selected.baseSalary : undefined,
        bonus: typeof selected.bonus === 'number' ? selected.bonus : undefined,
        bonusPct: typeof selected.bonusPct === 'number' ? selected.bonusPct : undefined,
        rsuValue: typeof selected.rsuValue === 'number' ? selected.rsuValue : undefined,
        rsuCurrency: typeof selected.rsuCurrency === 'string' ? selected.rsuCurrency : undefined,
        effectiveTaxRate: typeof selected.effectiveTaxRate === 'number' ? selected.effectiveTaxRate : undefined,
        currency: typeof selected.currency === 'string' ? selected.currency : income_country.trim(),
      };

      const formData = {
        ...topLevel,
        yearly,
      };

      const save = await fetchJson('/api/user-data', {
        method: 'POST',
        body: JSON.stringify({
          token: t,
          formType: 'income',
          formData,
          sharedData: mergedShared,
        }),
      });

      return jsonResult(save.data, !save.ok || save.status >= 400);
    }
  );

  server.tool(
    'asset.save',
    'Save assets + liabilities (UI: Assets and liabilities). Client LLM must supply values; server does not parse.',
    {
      token: z.string().optional(),
      assets_country: z.string().min(1).describe('Country key used by UI currency selector (e.g. "India", "US")'),
      accounts: z
        .array(
          z.object({
            type: z.enum(['savings', 'brokerage', 'property', 'crypto', 'other']),
            currency: z.string().min(1),
            name: z.string().optional(),
            total: z.number().optional(),
            label: z.string().optional().describe('Required when type=other (UI uses label for “Other”).'),
            comment: z.string().optional(),
          })
        )
        .describe('Asset accounts rows (omit blank rows).'),
      liabilities: z
        .array(
          z.object({
            type: z.enum(['personal_loan', 'car_loan', 'credit_card', 'mortgage', 'other']),
            name: z.string().optional(),
            currency: z.string().min(1),
            total: z.number().optional(),
            comment: z.string().optional(),
          })
        )
        .describe('Liabilities rows (omit blank rows).'),
      quarterly_snapshots: z
        .array(
          z.object({
            quarter: z.string().min(1).describe('e.g. 2026-Q1'),
            captured_at: z.string().min(1).describe('ISO timestamp'),
            accounts: z.array(
              z.object({
                type: z.string(),
                currency: z.string(),
                name: z.string().optional(),
                total: z.number().optional(),
                label: z.string().optional(),
                comment: z.string().optional(),
              })
            ),
            liabilities: z.array(
              z.object({
                type: z.string(),
                name: z.string().optional(),
                currency: z.string(),
                total: z.number().optional(),
                comment: z.string().optional(),
              })
            ),
          })
        )
        .optional()
        .describe('Optional snapshot history (can be empty/omitted).'),
    },
    {
      title: 'Save assets answers',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    async ({ token, assets_country, accounts, liabilities, quarterly_snapshots }, extra) => {
      const t = resolveToken(token, extra);
      if (!t) return jsonResult({ error: 'token required' }, true);

      const existing = await loadUserDataOrNull(t);
      const mergedShared = mergeSharedData(existing?.shared_data, { assets_country: assets_country.trim() });

      const formData = {
        currency: assets_country.trim(),
        accounts,
        liabilities,
        quarterly_snapshots: quarterly_snapshots ?? [],
      };

      const save = await fetchJson('/api/user-data', {
        method: 'POST',
        body: JSON.stringify({
          token: t,
          formType: 'assets',
          formData,
          sharedData: mergedShared,
        }),
      });

      return jsonResult(save.data, !save.ok || save.status >= 400);
    }
  );

  server.tool(
    'other.reminders.list',
    'List reminders created via the main-site “Add reminder” widget.',
    { token: z.string().optional() },
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
    'other.reminders.create',
    'Create a main-site reminder (lightweight check-in). For email/WhatsApp/webhooks, use Nags.',
    {
      token: z.string().optional(),
      description: z.string().min(1),
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
    'other.reminders.delete',
    'Delete a main-site reminder row by id (from reminders.list).',
    {
      token: z.string().optional(),
      reminder_id: z.string().uuid(),
    },
    {
      title: 'Delete reminder',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    async ({ token, reminder_id }, extra) => {
      const t = resolveToken(token, extra);
      if (!t) return jsonResult({ error: 'token required' }, true);
      const q = new URLSearchParams({ token: t, id: reminder_id });
      const { ok, status, data } = await fetchJson(`/api/reminders?${q}`, { method: 'DELETE' });
      return jsonResult(data, !ok || status >= 400);
    }
  );

  server.tool(
    'other.currency_rates',
    'List stored FX rates (optional month=YYYY-MM per /api/currency-rates).',
    {
      token: z.string().optional(),
      month: z.string().optional().describe('YYYY-MM for one month; omit for rolling window'),
    },
    {
      title: 'Currency rates',
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
      const qs = q.toString();
      const { ok, status, data } = await fetchJson(`/api/currency-rates${qs ? `?${qs}` : ''}`, {
        method: 'GET',
      });
      return jsonResult(data, !ok || status >= 400);
    }
  );

  server.tool(
    'other.currency_coverage',
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

  server.prompt(
    'wealth.start_with_user_data',
    'Get wealth profile baseline before deeper calls',
    {
      token: z.string().optional(),
    },
    async ({ token }) => ({
      description: 'Load wealth baseline and route cross-domain requests to orchestrator.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              token ? `Use this token override: ${token}` : 'Use configured token header/env.',
              'Call data.user_data first to establish baseline.',
              'If user asks about goals + wealth together, switch to zoro-orchestrator (orchestrator.summary).',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'wealth.onboarding.expenses.step0_estimates',
    'Produce the exact JSON payload for saving expense estimates (no server-side parsing).',
    {},
    async () => ({
      description: 'Client LLM should compute totals and then call expenses.set_estimates.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'You are helping fill Zoro Expenses (UI step 0: monthly estimates).',
              '',
              'Important:',
              '- We do NOT rely on our backend LLM to parse. You (client LLM) must produce structured JSON.',
              '- Output ONLY JSON matching the schema below. No prose.',
              '',
              'JSON schema (output exactly these keys):',
              '{',
              '  "expenses_country": "India|US|...",',
              '  "buckets": {',
              '    "housing": 0,',
              '    "food": 0,',
              '    "transportation": 0,',
              '    "healthcare": 0,',
              '    "entertainment": 0,',
              '    "other": 0,',
              '    "one_time": 0,',
              '    "travel": 0',
              '  }',
              '}',
              '',
              'Rules:',
              '- Values are totals as numbers (same currency as expenses_country selection). Use 0 when unknown.',
              '- one_time and travel are annual-budget style buckets in UI, but we still store them as numeric totals here.',
              '',
              'After outputting JSON, call tool expenses.set_estimates with that JSON.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'wealth.onboarding.expenses.step1_2_monthly_actuals',
    'Produce the exact JSON payload for saving monthly actual expense totals (no server-side parsing).',
    {},
    async () => ({
      description: 'Client LLM should compute month totals and then call expenses.save_monthly_actuals_totals.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'You are helping fill Zoro Expenses (UI steps 1–2: monthly actuals + review).',
              '',
              'Important:',
              '- We do NOT rely on our backend LLM to parse PDFs/tables. You (client LLM) must compute category totals.',
              '- Output ONLY JSON matching the schema below. No prose.',
              '',
              'JSON schema:',
              '{',
              '  "month": "YYYY-MM",',
              '  "buckets": {',
              '    "housing": 0,',
              '    "food": 0,',
              '    "transportation": 0,',
              '    "healthcare": 0,',
              '    "entertainment": 0,',
              '    "other": 0,',
              '    "one_time": 0,',
              '    "travel": 0',
              '  },',
              '  "import_account_name": "optional string"',
              '}',
              '',
              'Category mapping guidance (to help you compute totals):',
              '- housing: rent/mortgage/utilities',
              '- food: groceries/restaurants',
              '- transportation: gas/transit/car',
              '- healthcare: doctor/insurance/pharmacy',
              '- entertainment: subscriptions/leisure',
              '- travel: flights/hotels/trips',
              '- one_time: one-off purchases that should not affect recurring spend',
              '- other: everything else',
              '',
              'Exclude from totals:',
              '- transfers to yourself, internal transfers, credit card payments, refunds/chargebacks.',
              '',
              'After outputting JSON, call tool expenses.save_monthly_actuals_totals with that JSON.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'wealth.onboarding.income.save_payload',
    'Produce the exact JSON payload for saving income by year (no server-side parsing).',
    {},
    async () => ({
      description: 'Client LLM should extract numbers and then call income.save.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'You are helping fill Zoro Income details (UI).',
              '',
              'Important:',
              '- We do NOT rely on our backend LLM to parse. You (client LLM) must produce structured JSON.',
              '- Output ONLY JSON matching the schema below. No prose.',
              '',
              'JSON schema:',
              '{',
              '  "income_country": "India|US|...",',
              '  "active_year": "YYYY",',
              '  "yearly": {',
              '    "YYYY": {',
              '      "job": "optional string",',
              '      "baseSalary": 0,',
              '      "bonus": 0,',
              '      "bonusPct": 0,',
              '      "rsuValue": 0,',
              '      "rsuCurrency": "optional country key (e.g. US)",',
              '      "effectiveTaxRate": 0,',
              '      "currency": "optional country key (defaults to income_country)"',
              '    }',
              '  }',
              '}',
              '',
              'Rules:',
              '- baseSalary and bonus are annual amounts (numbers). If only monthly is known, convert to annual before output.',
              '- bonusPct is 0..100 (e.g. 15 for 15%). Prefer bonus over bonusPct if you have an explicit amount.',
              '- Use 0 for unknown numeric values; omit optional strings when unknown.',
              '',
              'After outputting JSON, call tool income.save with that JSON.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'wealth.onboarding.assets.save_payload',
    'Produce the exact JSON payload for saving assets and liabilities (no server-side parsing).',
    {},
    async () => ({
      description: 'Client LLM should structure accounts/liabilities and then call asset.save.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'You are helping fill Zoro Assets & liabilities (UI).',
              '',
              'Important:',
              '- We do NOT rely on our backend LLM to parse. You (client LLM) must produce structured JSON.',
              '- Output ONLY JSON matching the schema below. No prose.',
              '',
              'JSON schema:',
              '{',
              '  "assets_country": "India|US|...",',
              '  "accounts": [',
              '    { "type": "savings|brokerage|property|crypto|other", "currency": "India|US|...", "name": "optional", "total": 0, "label": "optional (used for other)", "comment": "optional" }',
              '  ],',
              '  "liabilities": [',
              '    { "type": "personal_loan|car_loan|credit_card|mortgage|other", "currency": "India|US|...", "name": "optional", "total": 0, "comment": "optional" }',
              '  ],',
              '  "quarterly_snapshots": []',
              '}',
              '',
              'Rules:',
              '- Omit blank rows; totals are numbers; currency uses country keys consistent with FX tables.',
              '- If type="other" for an asset, include a human label in "label".',
              '- quarterly_snapshots can be [] if you are not capturing a snapshot history.',
              '',
              'After outputting JSON, call tool asset.save with that JSON.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'wealth.onboarding.misc.reminders_payload',
    'Produce the exact JSON payload for creating a lightweight reminder (same as AddReminderForm).',
    {},
    async () => ({
      description: 'Client LLM should structure reminder fields and then call other.reminders.create.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'You are helping set a lightweight recurring reminder (UI: Add reminder on wealth pages).',
              '',
              'Important:',
              '- Output ONLY JSON matching the schema below. No prose.',
              '',
              'JSON schema:',
              '{',
              '  "context": "income|assets|expenses",',
              '  "description": "string",',
              '  "recurrence": "monthly|quarterly|annually",',
              '  "recurrence_day": 1,',
              '  "recurrence_week": 1,',
              '  "recurrence_month": 1,',
              '  "priority": "optional string"',
              '}',
              '',
              'Rules:',
              '- If recurrence="monthly", provide recurrence_day (1..31).',
              '- If recurrence="quarterly", provide recurrence_week (1..4).',
              '- If recurrence="annually", provide recurrence_month (1..12).',
              '- For email/WhatsApp schedules and webhooks, use the Nags product instead.',
              '',
              'After outputting JSON, call tool other.reminders.create with that JSON.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'wealth.review_monthly_expenses',
    'Inspect monthly spending buckets',
    {
      token: z.string().optional(),
      month: z.string().optional().describe('YYYY-MM-01 month key'),
    },
    async ({ token, month }) => ({
      description: 'Fetch monthly expenses and highlight major categories.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              token ? `Use this token override: ${token}` : 'Use configured token header/env.',
              `Target month: ${month || 'latest available/list all months first'}.`,
              'Call expenses.monthly and summarize top categories + anomalies.',
              'If user asks for reminders or broader planning, route to zoro-orchestrator.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'wealth.review_estimates',
    'Analyze expense estimate snapshots',
    {
      token: z.string().optional(),
      latest: z.boolean().optional(),
    },
    async ({ token, latest }) => ({
      description: 'Fetch estimate snapshots and suggest next actions.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              token ? `Use this token override: ${token}` : 'Use configured token header/env.',
              `Latest only: ${latest === true ? 'yes' : 'no'}.`,
              'Call expenses.estimates, then summarize trend direction and biggest drivers.',
              'For goal impact questions, route to zoro-orchestrator.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'wealth.check_currency_rates',
    'Inspect available FX rates for reporting',
    {
      token: z.string().optional(),
      month: z.string().optional().describe('YYYY-MM optional'),
    },
    async ({ token, month }) => ({
      description: 'Fetch FX rates and return concise coverage notes.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              token ? `Use this token override: ${token}` : 'Use configured token header/env.',
              `Month filter: ${month || 'none'}.`,
              'Call other.currency_rates and summarize base currencies + date coverage.',
              'If there are missing conversions, also call other.currency_coverage.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'wealth.find_currency_gaps',
    'Find missing FX pairs impacting user data',
    {
      token: z.string().optional(),
    },
    async ({ token }) => ({
      description: 'Identify FX coverage gaps and recommend what to backfill.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              token ? `Use this token override: ${token}` : 'Use configured token header/env.',
              'Call other.currency_coverage and return missing month/currency pairs.',
              'If user asks for next-step prioritization across goals/reminders, route to zoro-orchestrator.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = createWealthMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
