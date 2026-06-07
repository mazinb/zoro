import { NextRequest, NextResponse } from 'next/server';

function toNonEmptyString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

type ImportKind = 'asset' | 'liability' | 'cashflow';

type AttachmentIn = {
  mimeType: string;
  dataBase64: string;
  fileName?: string;
};

async function geminiJsonCompletion(params: {
  system: string;
  user: string;
  attachments?: AttachmentIn[];
}): Promise<Record<string, unknown>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Cloud import is unavailable');

  const model =
    process.env.GEMINI_LEDGER_IMPORT_MODEL?.trim() || 'gemini-2.5-flash';

  const parts: Array<Record<string, unknown>> = [];
  for (const att of params.attachments ?? []) {
    const mime = att.mimeType?.trim();
    const data = att.dataBase64?.trim();
    if (!mime || !data) continue;
    parts.push({ inlineData: { mimeType: mime, data } });
  }
  parts.push({ text: params.user.slice(0, 120_000) });

  const system = params.system.toLowerCase().includes('json')
    ? params.system.slice(0, 60_000)
    : `${params.system.slice(0, 60_000)}\n\nReturn a JSON object only (valid json).`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const lower = text.toLowerCase();
    if (res.status === 400 && (lower.includes('token') || lower.includes('too large'))) {
      throw new Error('FILE_TOO_LONG');
    }
    throw new Error(`Import failed (${res.status})`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!content.trim()) throw new Error('Import returned no content');
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error('Import returned invalid JSON');
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

  const attachmentsRaw = o.attachments;
  const attachments: AttachmentIn[] = [];
  if (Array.isArray(attachmentsRaw)) {
    for (const item of attachmentsRaw) {
      if (!item || typeof item !== 'object') continue;
      const m = item as Record<string, unknown>;
      const mimeType = toNonEmptyString(m.mimeType);
      const dataBase64 = toNonEmptyString(m.dataBase64);
      if (!mimeType || !dataBase64) continue;
      attachments.push({
        mimeType,
        dataBase64,
        fileName: toNonEmptyString(m.fileName) ?? undefined,
      });
    }
  }

  try {
    const obj = await geminiJsonCompletion({ system, user, attachments });
    return NextResponse.json({ data: obj });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Import failed';
    if (msg === 'FILE_TOO_LONG') {
      return NextResponse.json({ error: 'File too long.' }, { status: 413 });
    }
    return NextResponse.json({ error: 'Import failed. Try again.' }, { status: 502 });
  }
}
