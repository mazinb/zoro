export function tokensFromOpenAiUsage(usage: unknown): number {
  if (!usage || typeof usage !== 'object') return 0;
  const u = usage as Record<string, unknown>;
  const total = u.total_tokens;
  if (typeof total === 'number' && Number.isFinite(total)) return Math.max(0, Math.round(total));
  const prompt = typeof u.prompt_tokens === 'number' ? u.prompt_tokens : 0;
  const completion = typeof u.completion_tokens === 'number' ? u.completion_tokens : 0;
  return Math.max(0, Math.round(prompt + completion));
}

export function tokensFromGeminiUsage(meta: unknown): number {
  if (!meta || typeof meta !== 'object') return 0;
  const m = meta as Record<string, unknown>;
  const total = m.totalTokenCount;
  if (typeof total === 'number' && Number.isFinite(total)) return Math.max(0, Math.round(total));
  const prompt = typeof m.promptTokenCount === 'number' ? m.promptTokenCount : 0;
  const candidates = typeof m.candidatesTokenCount === 'number' ? m.candidatesTokenCount : 0;
  return Math.max(0, Math.round(prompt + candidates));
}

export function estimateTokensFromText(parts: string[]): number {
  const n = parts.join('').length;
  return Math.max(1, Math.ceil(n / 4));
}
