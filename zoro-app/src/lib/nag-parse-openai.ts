import type { NagChannel, NagEndType, NagFrequency, NagScheduleInput } from './nag-types';
import {
  isNagChannel,
  isNagEndType,
  isNagFrequency,
  parseHHMM,
  validateScheduleBody,
} from './nag-types';

const SYSTEM = `You extract a recurring reminder schedule from the user's message.
Return ONLY a JSON object with these keys (no markdown):
- message: short task title (string)
- channel: "email" or "whatsapp" — only if clearly implied; else null
- frequency: one of "daily", "weekly", "monthly", "once"
- time_hhmm: "HH:MM" 24-hour string in UTC. If user gives local time with no timezone, assume UTC.
- day_of_week: integer 0-6 only if weekly — 0=Monday, 6=Sunday. Null if not weekly.
- day_of_month: integer 1-31 only if monthly. Null if not monthly.
- end_type: "forever", "until_date", or "occurrences"
- until_date: "YYYY-MM-DD" if end_type is until_date or user gave an end date; else null
- occurrences_max: positive integer if end_type is occurrences or user said "N times"; else null

Rules:
- If frequency is weekly and day unclear, use day_of_week 4 (Friday).
- If frequency is monthly and day unclear, use day_of_month 1.
- If no time mentioned, use "10:00".
- If end unclear and not a single shot, use end_type "forever" with until_date null.
- For a one-shot reminder on a specific date, use frequency "once" and until_date that day.`;

export type ParseDraft = NagScheduleInput & { parse_fallback: boolean };

function fallbackDraft(text: string, defaultChannel: NagChannel): ParseDraft {
  const trimmed = text.trim() || 'Reminder';
  return {
    message: trimmed.length > 200 ? `${trimmed.slice(0, 197)}…` : trimmed,
    channel: defaultChannel,
    frequency: 'weekly',
    time_hhmm: '10:00',
    day_of_week: 4,
    day_of_month: null,
    end_type: 'forever',
    until_date: null,
    occurrences_max: null,
    parse_fallback: true,
  };
}

function openAiJsonToBody(
  raw: Record<string, unknown>,
  defaultChannel: NagChannel
): Record<string, unknown> {
  const message = typeof raw.message === 'string' ? raw.message.trim() : '';
  const channel: NagChannel =
    typeof raw.channel === 'string' && isNagChannel(raw.channel) ? raw.channel : defaultChannel;

  const frequency: NagFrequency =
    typeof raw.frequency === 'string' && isNagFrequency(raw.frequency) ? raw.frequency : 'weekly';

  let time_hhmm = typeof raw.time_hhmm === 'string' ? raw.time_hhmm.trim() : '10:00';
  if (!parseHHMM(time_hhmm)) time_hhmm = '10:00';

  let day_of_week: number | null = null;
  if (raw.day_of_week !== undefined && raw.day_of_week !== null) {
    const d = Number(raw.day_of_week);
    if (Number.isInteger(d) && d >= 0 && d <= 6) day_of_week = d;
  }
  if (frequency === 'weekly' && day_of_week === null) day_of_week = 4;

  let day_of_month: number | null = null;
  if (raw.day_of_month !== undefined && raw.day_of_month !== null) {
    const d = Number(raw.day_of_month);
    if (Number.isInteger(d) && d >= 1 && d <= 31) day_of_month = d;
  }
  if (frequency === 'monthly' && day_of_month === null) day_of_month = 1;

  let end_type: NagEndType = 'forever';
  if (typeof raw.end_type === 'string' && isNagEndType(raw.end_type)) {
    end_type = raw.end_type;
  }

  let until_date: string | null = null;
  if (typeof raw.until_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.until_date)) {
    until_date = raw.until_date;
  }

  let occurrences_max: number | null = null;
  if (raw.occurrences_max !== undefined && raw.occurrences_max !== null) {
    const n = Number(raw.occurrences_max);
    if (Number.isInteger(n) && n >= 1) occurrences_max = n;
  }

  if (frequency === 'once' && !until_date) {
    until_date = new Date().toISOString().slice(0, 10);
  }

  return {
    message,
    channel,
    frequency,
    time_hhmm,
    day_of_week,
    day_of_month,
    end_type,
    until_date,
    occurrences_max,
  };
}

export async function parseNagTextWithOpenAI(
  text: string,
  defaultChannel: NagChannel
): Promise<ParseDraft> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fallbackDraft(text, defaultChannel);
  }

  const model = process.env.OPENAI_NAG_PARSE_MODEL || 'gpt-4o-mini';

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: text.trim().slice(0, 4000) },
        ],
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      console.error('[nag-parse] OpenAI error:', res.status, await res.text());
      return fallbackDraft(text, defaultChannel);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return fallbackDraft(text, defaultChannel);
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content) as Record<string, unknown>;
    } catch {
      return fallbackDraft(text, defaultChannel);
    }

    const body = openAiJsonToBody(parsed, defaultChannel);
    const validated = validateScheduleBody(body);
    if (!validated.ok) {
      console.warn('[nag-parse] validate after OpenAI:', validated.error);
      return fallbackDraft(text, defaultChannel);
    }

    return { ...validated.data, parse_fallback: false };
  } catch (e) {
    console.error('[nag-parse]', e);
    return fallbackDraft(text, defaultChannel);
  }
}
