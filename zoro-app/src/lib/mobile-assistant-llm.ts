import { estimateTokensFromText, tokensFromGeminiUsage, tokensFromOpenAiUsage } from '@/lib/llm-usage';

export type AssistantCompletionParams = {
  system: string;
  user: string;
  preferJsonObject?: boolean;
  maxOutputTokens?: number;
};

function normalizeOpenAiBaseUrl(raw: string): string {
  const t = raw.trim().replace(/\/+$/, '');
  if (t.endsWith('/v1')) return t;
  return `${t}/v1`;
}

/** True when Qwen/vLLM is configured for Cloud AI assistants. */
export function isQwenAssistantConfigured(): boolean {
  return Boolean(process.env.QWEN_BASE_URL?.trim());
}

export async function geminiTextCompletion(
  params: AssistantCompletionParams,
): Promise<{ text: string; tokensUsed: number }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Cloud AI is unavailable');

  const model =
    process.env.GEMINI_LEDGER_IMPORT_MODEL?.trim() || 'gemini-2.5-flash';

  const system =
    params.preferJsonObject && !params.system.toLowerCase().includes('json')
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
    usageMetadata?: unknown;
  };
  const content = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!content.trim()) throw new Error('Assistant returned no content');
  const tokensUsed =
    tokensFromGeminiUsage(data.usageMetadata) || estimateTokensFromText([system, params.user, content]);
  return { text: content, tokensUsed };
}

/**
 * OpenAI-compatible chat completions (vLLM / Qwen on DGX Spark).
 * Env: QWEN_BASE_URL (required), QWEN_API_KEY (optional Bearer), QWEN_MODEL (optional).
 */
export async function qwenTextCompletion(
  params: AssistantCompletionParams,
): Promise<{ text: string; tokensUsed: number }> {
  const baseRaw = process.env.QWEN_BASE_URL?.trim();
  if (!baseRaw) throw new Error('Cloud AI is unavailable');

  const baseUrl = normalizeOpenAiBaseUrl(baseRaw);
  const apiKey = process.env.QWEN_API_KEY?.trim() || 'vllm';
  const model =
    process.env.QWEN_MODEL?.trim() || 'nvidia/Qwen3.6-35B-A3B-NVFP4';

  let system = params.system.slice(0, 60_000);
  if (params.preferJsonObject && !`${system}\n${params.user}`.toLowerCase().includes('json')) {
    system = `${system}\n\nWhen returning structured output, reply as a JSON object (valid json).`;
  }

  const url = `${baseUrl}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: params.maxOutputTokens ?? 8192,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: params.user.slice(0, 120_000) },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const lower = text.toLowerCase();
    if (
      res.status === 400 &&
      (lower.includes('token') ||
        lower.includes('too large') ||
        lower.includes('context') ||
        lower.includes('maximum'))
    ) {
      throw new Error('FILE_TOO_LONG');
    }
    throw new Error(`Assistant failed (${res.status})`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    usage?: unknown;
  };
  const content = data.choices?.[0]?.message?.content?.trim() ?? '';
  if (!content) throw new Error('Assistant returned no content');
  const tokensUsed =
    tokensFromOpenAiUsage(data.usage) || estimateTokensFromText([system, params.user, content]);
  return { text: content, tokensUsed };
}

/** Prefer Qwen when configured; otherwise Gemini. */
export async function cloudAssistantCompletion(
  params: AssistantCompletionParams,
): Promise<{ text: string; backend: 'qwen' | 'gemini'; tokensUsed: number }> {
  if (isQwenAssistantConfigured()) {
    const out = await qwenTextCompletion(params);
    return { ...out, backend: 'qwen' };
  }
  const out = await geminiTextCompletion(params);
  return { ...out, backend: 'gemini' };
}
