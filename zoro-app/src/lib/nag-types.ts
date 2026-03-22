export const NAG_FREQUENCIES = ['daily', 'weekly', 'monthly', 'once'] as const;
export type NagFrequency = (typeof NAG_FREQUENCIES)[number];

export const NAG_CHANNELS = ['email', 'whatsapp'] as const;
export type NagChannel = (typeof NAG_CHANNELS)[number];

export const NAG_END_TYPES = ['forever', 'until_date', 'occurrences'] as const;
export type NagEndType = (typeof NAG_END_TYPES)[number];

export const NAG_STATUSES = ['active', 'archived', 'cancelled'] as const;
export type NagStatus = (typeof NAG_STATUSES)[number];

export type NagRow = {
  id: string;
  user_id: string;
  message: string;
  channel: NagChannel;
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
  created_at: string;
  updated_at: string;
};

export type NagScheduleInput = {
  message: string;
  channel: NagChannel;
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
