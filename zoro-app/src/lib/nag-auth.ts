import type { ResolveTokenResult } from '@/lib/resolve-token';

/**
 * Map token resolution failures for Nag routes. Invalid link returns 404 from
 * resolveTokenToUserId; we use 401 here so clients don't confuse it with a missing route.
 */
export function nagAuthErrorResponse(resolved: ResolveTokenResult): { error: string; status: number } | null {
  if ('userId' in resolved) return null;
  const status = resolved.status === 404 ? 401 : resolved.status;
  return { error: resolved.error, status };
}

export type NagAuthResult =
  | { ok: true; userId: string }
  | { ok: false; error: string; status: number };

/** Use after resolveTokenToUserId so TypeScript narrows userId. */
export function nagRequireUserId(resolved: ResolveTokenResult): NagAuthResult {
  const err = nagAuthErrorResponse(resolved);
  if (err) return { ok: false, ...err };
  if ('userId' in resolved) {
    return { ok: true, userId: resolved.userId };
  }
  return { ok: false, error: 'Unauthorized', status: 401 };
}
