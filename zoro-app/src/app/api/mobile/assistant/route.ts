import { NextRequest, NextResponse } from 'next/server';

function toNonEmptyString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

async function geminiTextCompletion(params: {
  system: string;
  user: string;
  preferJsonObject?: boolean;
  maxOutputTokens?: number;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Cloud AI is unavailable');

  const model =
    process.env.GEMINI_LEDGER_IMPORT_MODEL?.trim() || 'gemini-2.5-flash';

  const system = params.preferJsonObject && !params.system.toLowerCase().includes('json')
    ? `${params.system.slice(0, 60_000)}\n\nReturn a JSON object only (valid json).`
    : params.system.slice(0, 60_000);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: params.user.slice(0, 120_000) }] }],
      generationConfig: {
        temperature: 0.2,
        ...(params.preferJsonObject ? { responseMimeType: 'application/json' } : {}),
        maxOutputTokens: params.maxOutputTokens ?? 8192,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const lower = text.toLowerCase();
    if (res.status === 400 && (lower.includes('token') || lower.includes('too large'))) {
      throw new Error('FILE_TOO_LONG');
    }
    throw new Error(`Assistant failed (${res.status})`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!content.trim()) throw new Error('Assistant returned no content');
  return content;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const o = (body ?? {}) as Record<string, unknown>;
  const deviceId = toNonEmptyString(o.deviceId);
  const system = toNonEmptyString(o.system);
  const user = toNonEmptyString(o.user);
  if (!deviceId || !system || !user) {
    return NextResponse.json(
      { error: 'deviceId, system, and user are required' },
      { status: 400 },
    );
  }

  const preferJsonObject = o.preferJsonObject === true;
  const maxOutputTokens =
    typeof o.maxOutputTokens === 'number' && Number.isFinite(o.maxOutputTokens)
      ? Math.min(Math.max(Math.round(o.maxOutputTokens), 64), 8192)
      : undefined;

  try {
    const text = await geminiTextCompletion({
      system,
      user,
      preferJsonObject,
      maxOutputTokens,
    });
    return NextResponse.json({ text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Assistant failed';
    if (msg === 'FILE_TOO_LONG') {
      return NextResponse.json({ error: 'Prompt too long.' }, { status: 413 });
    }
    return NextResponse.json({ error: 'Assistant failed. Try again.' }, { status: 502 });
  }
}
