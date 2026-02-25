import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { resolveTokenToUserId } from '@/lib/resolve-token';
import type { CategorizedExpenses, ExpenseItem } from '@/components/expenses/types';

const EXPENSE_CATEGORIES = ['housing', 'food', 'transportation', 'healthcare', 'entertainment', 'other', 'one_time'] as const;
const CATEGORIES_WITH_TRANSFER = [...EXPENSE_CATEGORIES, 'transfer'] as const;

const LOG_PREFIX = '[parse-paste]';

function toNum(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.-]/g, ''));
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function normalizeItem(x: unknown): ExpenseItem | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const desc = typeof o.description === 'string' ? o.description : String(o.description ?? '');
  const amount = toNum(o.amount);
  return { description: desc || 'Unknown', amount };
}

function parseBucketsFromResponse(
  response: { text?: string; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> },
  categories: readonly string[]
): CategorizedExpenses {
  let text =
    response.text?.trim() ??
    (response.candidates?.[0]?.content?.parts
      ?.filter((p: { text?: string }) => p.text)
      .map((p: { text?: string }) => p.text)
      .join('') ?? '')
      .trim();
  if (!text) return {};
  const codeBlock = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/m;
  const match = text.match(codeBlock);
  if (match) text = match[1].trim();
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return {};
  }
  const buckets: CategorizedExpenses = {};
  const obj = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  for (const cat of categories) {
    const raw = obj[cat];
    if (!Array.isArray(raw)) {
      buckets[cat] = [];
      continue;
    }
    const items: ExpenseItem[] = [];
    for (const x of raw) {
      const item = normalizeItem(x);
      if (item) items.push(item);
    }
    buckets[cat] = items;
  }
  return buckets;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Server missing GEMINI_API_KEY' }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { token, month: monthStr, pastedText, sourceType: sourceTypeRaw, fileName: fileNameRaw } = body as {
    token?: string;
    month?: string;
    pastedText?: string;
    sourceType?: string;
    fileName?: string;
  };

  const tokenVal = typeof token === 'string' ? token.trim() : '';
  if (!tokenVal) {
    return NextResponse.json({ error: 'Token is required.' }, { status: 400 });
  }

  const resolved = await resolveTokenToUserId(tokenVal);
  if ('error' in resolved) {
    return NextResponse.json(
      { error: resolved.error === 'Invalid or expired link' ? resolved.error : 'Invalid token.' },
      { status: resolved.status }
    );
  }

  if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
    return NextResponse.json({ error: 'month (YYYY-MM) is required for import.' }, { status: 400 });
  }

  const text = typeof pastedText === 'string' ? pastedText.trim() : '';
  if (!text || text.length > 100_000) {
    return NextResponse.json(
      { error: 'pastedText is required and must be under 100,000 characters.' },
      { status: 400 }
    );
  }

  const sourceType = sourceTypeRaw === 'checking' ? 'checking' : 'credit_card';
  const isChecking = sourceType === 'checking';
  const categories = isChecking ? CATEGORIES_WITH_TRANSFER : EXPENSE_CATEGORIES;
  const fileName = typeof fileNameRaw === 'string' && fileNameRaw.trim() ? fileNameRaw.trim() : 'Pasted data';

  console.log(`${LOG_PREFIX} Input: token, pastedText length=${text.length}, sourceType=${sourceType}`);

  const ai = new GoogleGenAI({ apiKey });

  const prompt = isChecking
    ? `Below is pasted transaction data from a CHECKING account. Parse it and classify each transaction into exactly these categories (use only these keys): ${categories.join(', ')}.

CRITICAL: Put in "transfer" any transaction that is NOT an expense: credit card payments, transfers to savings, transfers to other accounts. These will be excluded from spending totals.

For each category, output an array of items. Each item: "description" (short), "amount" (number, positive). Map real expenses: rent/utilities -> housing; groceries/restaurants -> food; gas/transit -> transportation; doctor/insurance -> healthcare; subscriptions/leisure -> entertainment; one-off -> one_time; else -> other. Transfers -> transfer.

Respond with ONLY a single JSON object in this exact shape, no other text:
{"housing":[],"food":[],"transportation":[],"healthcare":[],"entertainment":[],"other":[],"one_time":[],"transfer":[]}
Use empty arrays [] for categories with none.`

    : `Below is pasted transaction/expense data. Parse it and classify each line into exactly these categories (use only these keys): ${categories.join(', ')}.

For each category, output an array of expense items. Each item: "description" (short), "amount" (number, positive). Map: rent/utilities -> housing; groceries/restaurants -> food; gas/transit -> transportation; doctor/insurance -> healthcare; subscriptions/leisure -> entertainment; one-off purchases -> one_time; else -> other.

Respond with ONLY a single JSON object in this exact shape, no other text:
{"housing":[],"food":[],"transportation":[],"healthcare":[],"entertainment":[],"other":[],"one_time":[]}
Use empty arrays [] for categories with none.`;

  let response;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: `Pasted data:\n\n${text.slice(0, 30000)}\n\n${prompt}` }] }],
      config: { maxOutputTokens: 8192 },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Parsing failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const buckets = parseBucketsFromResponse(response as Parameters<typeof parseBucketsFromResponse>[0], categories);
  console.log(`${LOG_PREFIX} Done → returning { data: { fileName, buckets, sourceType } }`);
  return NextResponse.json({ data: { fileName, buckets, sourceType } });
}
