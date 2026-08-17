import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const SVIX_PREFIX = 'whsec_';

/** Verify Resend/Svix webhook signatures against the raw request body. */
export function verifySvixSignature(opts: {
  rawBody: string;
  secret: string;
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
  toleranceSec?: number;
}): boolean {
  const { rawBody, secret, svixId, svixTimestamp, svixSignature, toleranceSec = 300 } = opts;
  const ts = Number(svixTimestamp);
  if (!Number.isFinite(ts)) return false;
  const age = Math.abs(Date.now() / 1000 - ts);
  if (age > toleranceSec) return false;

  const key = secret.startsWith(SVIX_PREFIX) ? Buffer.from(secret.slice(SVIX_PREFIX.length), 'base64') : Buffer.from(secret, 'base64');
  const signed = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = createHmac('sha256', key).update(signed).digest('base64');
  const signatures = svixSignature
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.includes(',') ? part.split(',')[1] : part.replace(/^v1,/, '').replace(/^v1=/, '')));

  const expectedBuf = Buffer.from(expected);
  return signatures.some((sig) => {
    try {
      const got = Buffer.from(sig);
      return got.length === expectedBuf.length && timingSafeEqual(got, expectedBuf);
    } catch {
      return false;
    }
  });
}

export function randomSecret(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}
