import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, createUserContent, createPartFromUri } from '@google/genai';
import { FileState } from '@google/genai';
import { resolveTokenToUserId } from '@/lib/resolve-token';
import type { CategorizedExpenses, ExpenseItem } from '@/components/expenses/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getSupabase() {
  if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase configuration');
  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const CATEGORIES = ['housing', 'food', 'transportation', 'healthcare', 'entertainment', 'other'] as const;

const LOG_PREFIX = '[parse-one-file]';

async function waitForFileActive(
  ai: InstanceType<typeof GoogleGenAI>,
  fileName: string,
  maxWaitMs = 120_000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const file = await ai.files.get({ name: fileName });
    if (file.state === FileState.ACTIVE) return;
    if (file.state === FileState.FAILED) {
      throw new Error(file.error?.message ?? 'File processing failed');
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('File processing timed out');
}

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

function parseBucketsFromResponse(response: { text?: string; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }): CategorizedExpenses {
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
  for (const cat of CATEGORIES) {
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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const tokenRaw = formData.get('token');
  const token = typeof tokenRaw === 'string' ? tokenRaw.trim() : '';
  if (!token) {
    return NextResponse.json({ error: 'Token is required.' }, { status: 400 });
  }

  const resolved = await resolveTokenToUserId(token);
  if ('error' in resolved) {
    return NextResponse.json(
      { error: resolved.error === 'Invalid or expired link' ? resolved.error : 'Invalid token.' },
      { status: resolved.status }
    );
  }
  const userId = resolved.userId;

  const monthRaw = formData.get('month');
  const monthStr = typeof monthRaw === 'string' ? monthRaw.trim() : '';
  if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
    return NextResponse.json(
      { error: 'month (YYYY-MM) is required for import.' },
      { status: 400 }
    );
  }
  const monthDate = `${monthStr}-01`;

  const supabase = getSupabase();
  const { data: existing, error: existingError } = await supabase
    .from('monthly_expenses')
    .select('id, imported_at')
    .eq('user_id', userId)
    .eq('month', monthDate)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: 'Failed to check month.' }, { status: 500 });
  }
  if (existing?.imported_at) {
    return NextResponse.json(
      {
        error: 'Already imported',
        message: 'This month was already imported. You can edit totals manually; re-import is not allowed.',
      },
      { status: 409 }
    );
  }

  const file = formData.get('file') ?? formData.get('statement');
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'One PDF file is required.' }, { status: 400 });
  }
  if (file.type?.toLowerCase() !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF files are allowed.' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.` },
      { status: 400 }
    );
  }

  const fileNameRaw = formData.get('fileName');
  const fileName = typeof fileNameRaw === 'string' && fileNameRaw.trim() ? fileNameRaw.trim() : 'Statement';

  console.log(`${LOG_PREFIX} Input: token, 1 PDF, fileName=${fileName}`);

  const ai = new GoogleGenAI({ apiKey });
  let uploadedFile: { name?: string; uri?: string; mimeType?: string } | null = null;
  uploadedFile = await ai.files.upload({
    file,
    config: { mimeType: 'application/pdf' },
  });
  if (!uploadedFile?.name || !uploadedFile.uri || !uploadedFile.mimeType) {
    return NextResponse.json({ error: 'Invalid file response from upload' }, { status: 502 });
  }
  try {
    await waitForFileActive(ai, uploadedFile.name);
  } catch (e) {
    try {
      await ai.files.delete({ name: uploadedFile.name });
    } catch {
      /* ignore */
    }
    const msg = e instanceof Error ? e.message : 'Processing failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const prompt = `You are analyzing a bank statement PDF. Extract ALL expenses and classify each one into exactly these categories (use only these keys): ${CATEGORIES.join(', ')}.

For each category, output an array of expense items. Each item must have: "description" (short transaction/merchant description) and "amount" (number, positive = spending).
Map transactions to the best category: rent/mortgage/utilities -> housing; groceries/restaurants -> food; gas/transit/car -> transportation; doctor/insurance/pharmacy -> healthcare; subscriptions/leisure -> entertainment; everything else -> other.

Respond with ONLY a single JSON object in this exact shape, no other text or markdown:
{"housing":[{"description":"Rent","amount":1500}],"food":[{"description":"Grocery","amount":200}],"transportation":[],"healthcare":[],"entertainment":[],"other":[]}
Include every expense from the statement. Use empty arrays [] for categories with no expenses.`;

  let response;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: createUserContent([
        createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
        prompt,
      ]),
      config: { maxOutputTokens: 8192 },
    });
  } catch (e) {
    try {
      await ai.files.delete({ name: uploadedFile.name });
    } catch {
      /* ignore */
    }
    const msg = e instanceof Error ? e.message : 'Extraction failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  try {
    await ai.files.delete({ name: uploadedFile.name });
  } catch {
    /* best-effort */
  }

  const buckets = parseBucketsFromResponse(response as Parameters<typeof parseBucketsFromResponse>[0]);
  console.log(`${LOG_PREFIX} Done → returning { data: { fileName, buckets } }`);
  return NextResponse.json({ data: { fileName, buckets } });
}
