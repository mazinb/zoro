export const NAG_FREQUENCIES = ['daily', 'weekly', 'monthly', 'once'] as const;
export type NagFrequency = (typeof NAG_FREQUENCIES)[number];

export const NAG_CHANNELS = ['email', 'whatsapp', 'webhook'] as const;
export type NagChannel = (typeof NAG_CHANNELS)[number];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(v: string): boolean {
  return UUID_RE.test(v.trim());
}

export const NAG_END_TYPES = ['forever', 'until_date', 'occurrences'] as const;
export type NagEndType = (typeof NAG_END_TYPES)[number];

export const NAG_STATUSES = ['active', 'archived', 'cancelled'] as const;
export type NagStatus = (typeof NAG_STATUSES)[number];

export const NAG_LINK_DOMAINS = ['wealth', 'goal'] as const;
export type NagLinkDomain = (typeof NAG_LINK_DOMAINS)[number];

export type NagRow = {
  id: string;
  user_id: string;
  message: string;
  channel: NagChannel;
  /** Set when channel is webhook. */
  webhook_id: string | null;
  frequency: NagFrequency;
  time_hhmm: string;
  day_of_week: number | null;
  day_of_month: number | null;
  end_type: NagEndType;
  until_date: string | null;
  occurrences_max: number | null;
  occurrences_remaining: number | null;
  status: NagStatus;
  next_at: string | null;
  last_sent_at: string | null;
  /** Follow-up emails until the user marks the task done (email channel). */
  nag_until_done: boolean;
  /** Hours between sends while nag_until_done; null = default from frequency in app logic. */
  followup_interval_hours: number | null;
  /** Optional domain link so this nag can point to a specific wealth/goal item. */
  linked_domain: NagLinkDomain | null;
  /** Item key within the linked domain (e.g. expenses/save). */
  linked_key: string | null;
  /** Optional UI-friendly label for the linked item. */
  linked_label: string | null;
  /** Optional app path for direct navigation (e.g. /expenses, /save). */
  linked_path: string | null;
  created_at: string;
  updated_at: string;
};

const LINKED_KEYS: Record<NagLinkDomain, readonly string[]> = {
  wealth: ['expenses', 'income', 'assets'],
  goal: ['save', 'home', 'invest', 'insurance', 'tax', 'retire'],
};

export function parseNagLinkFields(
  body: Record<string, unknown>
): { ok: true; linked_domain: NagLinkDomain | null; linked_key: string | null; linked_label: string | null; linked_path: string | null } | { ok: false; error: string } {
  const rawDomain = typeof body.linked_domain === 'string' ? body.linked_domain.trim().toLowerCase() : '';
  const rawKey = typeof body.linked_key === 'string' ? body.linked_key.trim().toLowerCase() : '';
  const rawLabel = typeof body.linked_label === 'string' ? body.linked_label.trim() : '';
  const rawPath = typeof body.linked_path === 'string' ? body.linked_path.trim() : '';

  const wantsUnlink =
    body.linked_domain === null ||
    body.linked_key === null ||
    body.linked_path === null ||
    body.linked_label === null;
  if (!rawDomain && !rawKey && !rawLabel && !rawPath) {
    return { ok: true, linked_domain: null, linked_key: null, linked_label: null, linked_path: null };
  }
  if (wantsUnlink && !rawDomain && !rawKey) {
    return { ok: true, linked_domain: null, linked_key: null, linked_label: null, linked_path: null };
  }

  if (!rawDomain || !(NAG_LINK_DOMAINS as readonly string[]).includes(rawDomain)) {
    return { ok: false, error: 'linked_domain must be wealth or goal when setting a link' };
  }
  const domain = rawDomain as NagLinkDomain;
  if (!rawKey || !LINKED_KEYS[domain].includes(rawKey)) {
    return { ok: false, error: `linked_key is invalid for linked_domain=${domain}` };
  }
  if (rawPath && !rawPath.startsWith('/')) {
    return { ok: false, error: 'linked_path must start with /' };
  }

  return {
    ok: true,
    linked_domain: domain,
    linked_key: rawKey,
    linked_label: rawLabel || null,
    linked_path: rawPath || null,
  };
}

export function defaultFollowupHoursForFrequency(frequency: NagFrequency): number {
  switch (frequency) {
    case 'daily':
      return 24;
    case 'weekly':
      return 48;
    case 'monthly':
      return 168;
    case 'once':
      return 12;
    default:
      return 24;
  }
}

export function parseNagBehaviorFields(body: Record<string, unknown>):
  | { ok: true; nag_until_done: boolean; followup_interval_hours: number | null }
  | { ok: false; error: string } {
  let nag_until_done = false;
  if (body.nag_until_done === true) nag_until_done = true;
  if (body.nag_until_done === false) nag_until_done = false;

  let followup_interval_hours: number | null = null;
  if (body.followup_interval_hours !== undefined && body.followup_interval_hours !== null) {
    const n = Number(body.followup_interval_hours);
    if (!Number.isInteger(n) || n < 1 || n > 336) {
      return { ok: false, error: 'followup_interval_hours must be an integer 1–336 or null' };
    }
    followup_interval_hours = n;
  }

  if (!nag_until_done) {
    followup_interval_hours = null;
  }

  return { ok: true, nag_until_done, followup_interval_hours };
}

export type NagScheduleInput = {
  message: string;
  channel: NagChannel;
  webhook_id: string | null;
  frequency: NagFrequency;
  time_hhmm: string;
  day_of_week: number | null;
  day_of_month: number | null;
  end_type: NagEndType;
  until_date: string | null;
  occurrences_max: number | null;
};

export function isNagFrequency(v: string): v is NagFrequency {
  return (NAG_FREQUENCIES as readonly string[]).includes(v);
}

export function isNagChannel(v: string): v is NagChannel {
  return (NAG_CHANNELS as readonly string[]).includes(v);
}

export function isNagEndType(v: string): v is NagEndType {
  return (NAG_END_TYPES as readonly string[]).includes(v);
}

export function isNagStatus(v: string): v is NagStatus {
  return (NAG_STATUSES as readonly string[]).includes(v);
}

/** ISO weekday: 0 = Monday … 6 = Sunday → JavaScript getUTCDay() (Sun=0 … Sat=6) */
export function isoWeekdayToUtcJs(iso: number): number {
  return (iso + 1) % 7;
}

export function parseHHMM(s: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59 || Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return { hour, minute };
}

export function validateScheduleBody(
  body: Record<string, unknown>
): { ok: true; data: NagScheduleInput } | { ok: false; error: string } {
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return { ok: false, error: 'message is required' };

  const channelRaw = typeof body.channel === 'string' ? body.channel : 'email';
  if (!isNagChannel(channelRaw)) return { ok: false, error: 'invalid channel' };

  let webhook_id: string | null = null;
  if (channelRaw === 'webhook') {
    const wid = typeof body.webhook_id === 'string' ? body.webhook_id.trim() : '';
    if (!isUuid(wid)) return { ok: false, error: 'webhook_id must be a valid UUID when channel is webhook' };
    webhook_id = wid;
  }

  const freqRaw = typeof body.frequency === 'string' ? body.frequency : '';
  if (!isNagFrequency(freqRaw)) return { ok: false, error: 'invalid frequency' };

  const time_hhmm = typeof body.time_hhmm === 'string' ? body.time_hhmm.trim() : '';
  if (!parseHHMM(time_hhmm)) return { ok: false, error: 'time_hhmm must be HH:MM (24h UTC)' };

  const endRaw = typeof body.end_type === 'string' ? body.end_type : '';
  if (!isNagEndType(endRaw)) return { ok: false, error: 'invalid end_type' };

  let day_of_week: number | null = null;
  if (body.day_of_week !== undefined && body.day_of_week !== null) {
    const d = Number(body.day_of_week);
    if (!Number.isInteger(d) || d < 0 || d > 6) return { ok: false, error: 'day_of_week must be 0–6 (Mon–Sun)' };
    day_of_week = d;
  }

  let day_of_month: number | null = null;
  if (body.day_of_month !== undefined && body.day_of_month !== null) {
    const d = Number(body.day_of_month);
    if (!Number.isInteger(d) || d < 1 || d > 31) return { ok: false, error: 'day_of_month must be 1–31' };
    day_of_month = d;
  }

  let until_date: string | null = null;
  if (typeof body.until_date === 'string' && body.until_date.trim()) {
    until_date = body.until_date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until_date)) return { ok: false, error: 'until_date must be YYYY-MM-DD' };
  }

  let occurrences_max: number | null = null;
  if (body.occurrences_max !== undefined && body.occurrences_max !== null) {
    const n = Number(body.occurrences_max);
    if (!Number.isInteger(n) || n < 1) return { ok: false, error: 'occurrences_max must be a positive integer' };
    occurrences_max = n;
  }

  if (freqRaw === 'weekly' && day_of_week === null) {
    return { ok: false, error: 'day_of_week is required for weekly frequency' };
  }
  if (freqRaw === 'monthly' && day_of_month === null) {
    return { ok: false, error: 'day_of_month is required for monthly frequency' };
  }
  if (freqRaw === 'once' && !until_date) {
    return { ok: false, error: 'until_date is required for once frequency' };
  }
  if (endRaw === 'until_date' && !until_date) {
    return { ok: false, error: 'until_date is required when end_type is until_date' };
  }
  if (endRaw === 'occurrences' && (occurrences_max === null || occurrences_max < 1)) {
    return { ok: false, error: 'occurrences_max is required when end_type is occurrences' };
  }

  return {
    ok: true,
    data: {
      message,
      channel: channelRaw,
      webhook_id,
      frequency: freqRaw,
      time_hhmm,
      day_of_week,
      day_of_month,
      end_type: endRaw,
      until_date,
      occurrences_max: endRaw === 'occurrences' ? occurrences_max : null,
    },
  };
}
