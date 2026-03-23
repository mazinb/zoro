const DEFAULT_TIMEOUT_MS = 15000;

export type NagWhatsappResult =
  | { ok: true; messageId?: string; status?: string }
  | { ok: false; error: string };

function getRequiredEnv(name: string): string | null {
  const raw = process.env[name];
  if (!raw) return null;
  const value = raw.trim();
  return value ? value : null;
}

function normalizeE164(input: string): string | null {
  const cleaned = input.replace(/[^\d+]/g, '');
  if (!cleaned) return null;
  if (!cleaned.startsWith('+')) {
    const onlyDigits = cleaned.replace(/\D/g, '');
    return onlyDigits.length >= 8 ? onlyDigits : null;
  }
  const digits = cleaned.slice(1).replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

export async function sendNagWhatsapp(params: {
  text: string;
  to: string;
}): Promise<NagWhatsappResult> {
  const baseUrl = getRequiredEnv('EVOLUTION_API_BASE_URL');
  const apiKey = getRequiredEnv('EVOLUTION_API_KEY');
  const instance = getRequiredEnv('EVOLUTION_API_INSTANCE');

  if (!baseUrl) return { ok: false, error: 'EVOLUTION_API_BASE_URL not configured' };
  if (!apiKey) return { ok: false, error: 'EVOLUTION_API_KEY not configured' };
  if (!instance) return { ok: false, error: 'EVOLUTION_API_INSTANCE not configured' };

  const number = normalizeE164(params.to);
  if (!number) return { ok: false, error: 'Invalid destination phone number' };

  const timeoutMs = Number(process.env.EVOLUTION_API_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS);

  try {
    const url = `${baseUrl.replace(/\/$/, '')}/message/sendText/${encodeURIComponent(instance)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number,
        text: params.text,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: errText || `HTTP ${res.status}` };
    }

    const json = (await res.json()) as {
      key?: { id?: string };
      status?: string;
    };
    return { ok: true, messageId: json.key?.id, status: json.status };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'whatsapp send failed';
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
