/**
 * Shared MCP auth: verification_token from tool args, headers, or env.
 * Prefer header name `token` (case-insensitive) for Smithery and simple clients.
 */

export function getHeaderValue(headers, keys) {
  for (const key of keys) {
    const value = headers[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

/** Match header keys case-insensitively (Fetch/Node may normalize casing). */
export function getHeaderCaseInsensitive(headers, canonicalLower) {
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === canonicalLower) {
      const v = headers[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return '';
}

const LEGACY_TOKEN_HEADERS = [
  'x-token',
  'X-Token',
  'x-nag-mcp-token',
  'X-NAG-MCP-TOKEN',
  'x-nag-token',
  'X-NAG-TOKEN',
  'nagMcpToken',
  'nagmcptoken',
  'nag_token',
];

/**
 * @param {string|undefined} explicit - tool argument token
 * @param {object|undefined} extra - MCP handler extra (requestInfo.headers)
 */
export function resolveMcpToken(explicit, extra) {
  const t = typeof explicit === 'string' ? explicit.trim() : '';
  if (t) return t;

  const headers = extra?.requestInfo?.headers ?? {};

  const fromToken = getHeaderCaseInsensitive(headers, 'token');
  if (fromToken) return fromToken;

  const fromLegacy = getHeaderValue(headers, LEGACY_TOKEN_HEADERS);
  if (fromLegacy) return fromLegacy;

  const authRaw =
    getHeaderCaseInsensitive(headers, 'authorization') ||
    getHeaderValue(headers, ['authorization', 'Authorization']);
  const authBearer =
    typeof authRaw === 'string' && authRaw.toLowerCase().startsWith('bearer ')
      ? authRaw.slice(7).trim()
      : '';
  if (authBearer) return authBearer;

  return (
    (process.env.NAG_MCP_TOKEN || '').trim() ||
    (process.env.MCP_TOKEN || '').trim() ||
    (process.env.NEXT_PUBLIC_NAG_DEV_TOKEN || '').trim() ||
    ''
  );
}
