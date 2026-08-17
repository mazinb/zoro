import { effectiveIsPro } from '@/lib/mobile-entitlements';

export const TOKENS_PER_PACK = 100_000;
export const MONTHLY_FREE_TOKENS = 100_000;

export function clampInt(n: unknown, fallback = 0): number {
  const x = typeof n === 'number' ? n : typeof n === 'string' ? parseInt(n, 10) : NaN;
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.floor(x));
}

export function creditsFromTokens(tokenBalance: number): number {
  return Math.floor(Math.max(0, tokenBalance) / TOKENS_PER_PACK);
}

export type TokenEntitlementsRow = {
  device_id: string;
  is_pro: boolean;
  pro_expires_at: string | null;
  credits_balance?: number | null;
  token_balance?: number | null;
  tokens_used_total?: number | null;
  free_ai_month_key: string | null;
  free_ai_used: boolean;
  onboarding_imports_used?: number | null;
  onboarding_imports_eligible?: boolean | null;
  updated_at: string;
};

export function tokenBalanceFromRow(row: TokenEntitlementsRow): number {
  if (row.token_balance != null) return clampInt(row.token_balance, 0);
  return clampInt(row.credits_balance, 0) * TOKENS_PER_PACK;
}

export function entitlementsApiData(row: TokenEntitlementsRow): Record<string, unknown> {
  const tokenBalance = tokenBalanceFromRow(row);
  return {
    deviceId: row.device_id,
    isPro: effectiveIsPro({ is_pro: !!row.is_pro, pro_expires_at: row.pro_expires_at }),
    proExpiresAt: row.pro_expires_at,
    creditsBalance: creditsFromTokens(tokenBalance),
    tokenBalance,
    tokensUsedTotal: clampInt(row.tokens_used_total, 0),
    freeAiMonthKey: row.free_ai_month_key,
    freeAiUsed: !!row.free_ai_used,
    onboardingImportsUsed: clampInt(row.onboarding_imports_used, 0),
    onboardingImportsEligible: row.onboarding_imports_eligible !== false,
    updatedAt: row.updated_at,
  };
}

export function entitlementsApiDataFromConsume(row: Record<string, unknown>, deviceId: string) {
  return entitlementsApiData({
    device_id: String(row.device_id_out ?? deviceId),
    is_pro: !!row.is_pro,
    pro_expires_at: (row.pro_expires_at as string | null) ?? null,
    credits_balance: clampInt(row.credits_balance, 0),
    token_balance: clampInt(row.token_balance, 0),
    tokens_used_total: clampInt(row.tokens_used_total, 0),
    free_ai_month_key: (row.free_ai_month_key as string | null) ?? null,
    free_ai_used: !!row.free_ai_used,
    onboarding_imports_used: clampInt(row.onboarding_imports_used, 0),
    onboarding_imports_eligible: row.onboarding_imports_eligible !== false,
    updated_at: String(row.updated_at ?? ''),
  });
}
