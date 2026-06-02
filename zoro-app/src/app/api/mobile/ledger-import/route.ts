import { NextRequest, NextResponse } from 'next/server';

function toNonEmptyString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

type ImportKind = 'asset' | 'liability' | 'cashflow';

async function openAiJsonCompletion(params: {
  system: string;
  user: string;
  model?: string;
}): Promise<Record<string, unknown>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Server missing OPENAI_API_KEY');
  const model = params.model || process.env.OPENAI_LEDGER_IMPORT_MODEL || 'gpt-4o-mini';
  // OpenAI rejects json_object unless some message contains the word "json".
  const system = params.system.toLowerCase().includes('json')
    ? params.system
    : `${params.system}\n\nReturn a JSON object only (valid json).`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system.slice(0, 60_000) },
        { role: 'user', content: params.user.slice(0, 120_000) },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI import failed (${res.status}): ${text || 'no body'}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned no content');
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error('OpenAI returned non-JSON');
  }
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
  const kindRaw = toNonEmptyString(o.kind);
  const system = toNonEmptyString(o.system);
  const user = toNonEmptyString(o.user);
  if (!deviceId || !kindRaw || !system || !user) {
    return NextResponse.json(
      { error: 'deviceId, kind, system, and user are required' },
      { status: 400 }
    );
  }

  const kind = kindRaw as ImportKind;
  if (!['asset', 'liability', 'cashflow'].includes(kind)) {
    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  }

  try {
    const obj = await openAiJsonCompletion({ system, user });
    return NextResponse.json({ data: obj });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Import failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

