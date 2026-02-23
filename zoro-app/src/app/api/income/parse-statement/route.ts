import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, createUserContent, createPartFromUri } from '@google/genai';
import { FileState } from '@google/genai';
import { resolveTokenToUserId } from '@/lib/resolve-token';

type YearlyIncome = {
  job?: string;
  baseSalary?: number;
  bonus?: number;
  bonusPct?: number;
  rsuValue?: number;
  rsuCurrency?: string;
  effectiveTaxRate?: number;
  currency?: string;
};

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

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

function parseYearlyFromResponse(response: {
  text?: string;
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}): Record<string, YearlyIncome> {
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
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const obj = data as Record<string, unknown>;
  const yearly = obj.yearly;
  if (!yearly || typeof yearly !== 'object' || Array.isArray(yearly)) return {};
  const out: Record<string, YearlyIncome> = {};
  for (const [year, val] of Object.entries(yearly)) {
    if (!/^\d{4}$/.test(year) || !val || typeof val !== 'object') continue;
    const v = val as Record<string, unknown>;
    out[year] = {
      job: typeof v.job === 'string' ? v.job.trim() : undefined,
      baseSalary: toNum(v.baseSalary),
      bonus: toNum(v.bonus),
      bonusPct: toNum(v.bonusPct),
      rsuValue: toNum(v.rsuValue),
      rsuCurrency: typeof v.rsuCurrency === 'string' ? v.rsuCurrency : undefined,
      effectiveTaxRate: toNum(v.effectiveTaxRate),
      currency: typeof v.currency === 'string' ? v.currency : undefined,
    };
  }
  return out;
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

  const ai = new GoogleGenAI({ apiKey });
  const uploadedFile = await ai.files.upload({
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

  const prompt = `You are analyzing a compensation statement, offer letter, or tax/income document (PDF). Extract compensation data BY YEAR.

For each calendar year that appears in the document (e.g. 2024, 2023), extract:
- job: job title or employer name (string)
- baseSalary: annual base salary (number)
- bonus: annual bonus amount (number), or omit if not stated
- bonusPct: bonus as % of base (number), or omit
- rsuValue: RSU/stock grant value if mentioned (number)
- rsuCurrency: currency for RSU if different (e.g. "US")
- effectiveTaxRate: effective tax rate % if stated (number)
- currency: main currency for salary (e.g. "India", "US")

Respond with ONLY a JSON object in this exact shape, no other text or markdown:
{"yearly":{"2024":{"job":"Software Engineer at Acme","baseSalary":120000,"bonus":10000,"currency":"US","effectiveTaxRate":28},"2023":{...}}}

Use empty object {} for a year if nothing is found. Include every year that has compensation data.`;

  let response;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: createUserContent([
        createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
        prompt,
      ]),
      config: { maxOutputTokens: 4096 },
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

  const yearly = parseYearlyFromResponse(response as Parameters<typeof parseYearlyFromResponse>[0]);
  return NextResponse.json({ data: { yearly } });
}
