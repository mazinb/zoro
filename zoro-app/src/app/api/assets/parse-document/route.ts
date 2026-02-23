import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, createUserContent, createPartFromUri } from '@google/genai';
import { FileState } from '@google/genai';
import { resolveTokenToUserId } from '@/lib/resolve-token';

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
] as const;

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

function toNum(v: unknown): number | undefined {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.-]/g, ''));
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

const COUNTRY_KEYS = ['India', 'Thailand', 'UAE', 'Europe', 'US', 'Other'] as const;
function normalizeCurrency(v: unknown): string {
  if (typeof v === 'string' && COUNTRY_KEYS.includes(v as (typeof COUNTRY_KEYS)[number])) return v;
  const s = String(v ?? '').toLowerCase();
  if (s.includes('inr') || s === '₹' || s === 'inr') return 'India';
  if (s.includes('usd') || s === '$' || s === 'usd') return 'US';
  if (s.includes('eur') || s === '€' || s === 'eur') return 'Europe';
  if (s.includes('aed') || s === 'aed') return 'UAE';
  if (s.includes('thb') || s === '฿' || s === 'thb') return 'Thailand';
  return 'India';
}

const ASSET_TYPES = ['savings', 'brokerage', 'property', 'crypto', 'other'] as const;
const LIABILITY_TYPES = ['personal_loan', 'car_loan', 'credit_card', 'mortgage', 'other'] as const;

function parseResponse(
  response: { text?: string; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> },
  kind: 'account' | 'liability'
): { name: string; type?: string; currency?: string; total?: number } {
  let text =
    response.text?.trim() ??
    (response.candidates?.[0]?.content?.parts
      ?.filter((p: { text?: string }) => p.text)
      .map((p: { text?: string }) => p.text)
      .join('') ?? '')
      .trim();
  if (!text) return { name: '' };
  const codeBlock = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/m;
  const match = text.match(codeBlock);
  if (match) text = match[1].trim();
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) text = text.slice(firstBrace, lastBrace + 1);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { name: '' };
  }
  if (!data || typeof data !== 'object') return { name: '' };
  const o = data as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name.trim() : '';
  const typeStr = typeof o.type === 'string' ? o.type.toLowerCase() : '';
  const assetType = ASSET_TYPES.find((t) => typeStr.includes(t));
  const liabilityType = LIABILITY_TYPES.find((t) => typeStr.replace(/_/g, ' ').includes(t));
  const type = kind === 'account' ? (assetType ?? 'savings') : (liabilityType ?? 'other');
  const currency = normalizeCurrency(o.currency);
  const total = toNum(o.total);
  return { name: name || 'Imported', type, currency, total };
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

  const kindRaw = formData.get('kind');
  const kind = kindRaw === 'liability' ? 'liability' : 'account';

  const resolved = await resolveTokenToUserId(token);
  if ('error' in resolved) {
    return NextResponse.json(
      { error: resolved.error === 'Invalid or expired link' ? resolved.error : 'Invalid token.' },
      { status: resolved.status }
    );
  }

  const file = formData.get('file');
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'A file (image or PDF) is required.' }, { status: 400 });
  }
  const mime = (file.type || '').toLowerCase();
  const allowed = [...ALLOWED_TYPES].includes(mime as (typeof ALLOWED_TYPES)[number]);
  if (!allowed && mime) {
    return NextResponse.json({ error: 'File must be PDF or image (PNG, JPEG, WebP).' }, { status: 400 });
  }
  const mimeType = allowed ? mime : 'application/pdf';
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.` },
      { status: 400 }
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const uploadedFile = await ai.files.upload({
    file,
    config: { mimeType },
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

  const assetPrompt = `This image or PDF is a bank/brokerage/asset statement or screenshot. Extract exactly ONE asset/account entry.

Return a JSON object with:
- "name": A short descriptive name that includes the entity (e.g. "HDFC Bank Savings", "Fidelity 401k", "ICICI Fixed Deposit"). Use the institution or product name visible in the document.
- "type": One of: savings, brokerage, property, crypto, other
- "currency": One of: India, US, Europe, UAE, Thailand, Other (based on currency symbols or text in the document)
- "total": The current balance or total value as a number (no commas or symbols)

Respond with ONLY the JSON object, no other text.`;

  const liabilityPrompt = `This image or PDF is a loan, credit card, or liability statement or screenshot. Extract exactly ONE liability entry.

Return a JSON object with:
- "name": A short descriptive name that includes the entity (e.g. "Chase Sapphire Credit Card", "HDFC Home Loan", "SBI Personal Loan"). Use the lender or product name visible in the document.
- "type": One of: personal_loan, car_loan, credit_card, mortgage, other
- "currency": One of: India, US, Europe, UAE, Thailand, Other (based on currency in the document)
- "total": The amount owed / outstanding balance as a number (no commas or symbols)

Respond with ONLY the JSON object, no other text.`;

  const prompt = kind === 'account' ? assetPrompt : liabilityPrompt;

  let response;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: createUserContent([
        createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
        prompt,
      ]),
      config: { maxOutputTokens: 1024 },
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

  const data = parseResponse(response as Parameters<typeof parseResponse>[0], kind);
  return NextResponse.json({ data });
}
