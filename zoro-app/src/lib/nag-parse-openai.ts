import type { NagChannel, NagEndType, NagFrequency, NagScheduleInput } from './nag-types';
import {
  isNagChannel,
  isNagEndType,
  isNagFrequency,
  parseHHMM,
  validateScheduleBody,
} from './nag-types';
import {
  applyHeuristicGrounding,
  extractDayOfWeekFromText,
  extractFrequencyHint,
  extractTaskMessage,
  extractTimeHHMMFromText,
  type GroundingBody,
} from './nag-parse-heuristics';

function buildSystem(profileTimeZone: string): string {
  return `You extract a recurring reminder schedule from the user's message.
The user's profile IANA timezone is: ${profileTimeZone}
Return ONLY a JSON object with these keys (no markdown):
- message: short task title only — NOT the whole user sentence. Drop schedule phrases like "every Tuesday", "on Mondays". Example: user "mow the lawn every tuesday" → message "mow the lawn".
- channel: "email" or "whatsapp" — only if clearly implied; else null
- frequency: one of "daily", "weekly", "monthly", "once"
- time_hhmm: "HH:MM" 24-hour wall clock in ${profileTimeZone} for when the nag should fire. If the user names another timezone or offset, convert to the equivalent clock time in ${profileTimeZone}.
- day_of_week: REQUIRED when frequency is weekly. Integer 0-6 with 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday. Map "Tuesday"/"Tues"/"Tuesdays" → 1. Null only if frequency is not weekly.
- day_of_month: integer 1-31 only if monthly. Null if not monthly.
- end_type: "forever", "until_date", or "occurrences"
- until_date: "YYYY-MM-DD" if end_type is until_date or user gave an end date; else null (calendar date in ${profileTimeZone})
- occurrences_max: positive integer if end_type is occurrences or user said "N times"; else null

Rules:
- If the user names a weekday (Mon–Sun), frequency must be "weekly" and day_of_week must match that day.
- If frequency is weekly and day is still unclear, use day_of_week 4 (Friday).
- If frequency is monthly and day unclear, use day_of_month 1.
- If no time mentioned, use "10:00".
- If end unclear and not a single shot, use end_type "forever" with until_date null.
- For a one-shot reminder on a specific date, use frequency "once" and until_date that day.`;
}

export type ParseDraft = NagScheduleInput & { parse_fallback: boolean };

function fallbackDraft(text: string, defaultChannel: NagChannel): ParseDraft {
  const freqHint = extractFrequencyHint(text);
  const dow = extractDayOfWeekFromText(text);
  const time = extractTimeHHMMFromText(text) ?? '10:00';
  const refined = extractTaskMessage(text);
  const trimmed = text.trim() || 'Reminder';
  let message = refined.length > 0 ? refined : trimmed;
  if (message.length > 200) message = `${message.slice(0, 197)}…`;

  let frequency: NagFrequency = 'weekly';
  let day_of_week: number | null = dow ?? 4;
  let day_of_month: number | null = null;

  if (freqHint === 'daily') {
    frequency = 'daily';
    day_of_week = null;
  } else if (freqHint === 'monthly') {
    frequency = 'monthly';
    day_of_week = null;
    day_of_month = 1;
  } else {
    frequency = 'weekly';
    day_of_week = dow ?? 4;
  }

  return {
    message,
    channel: defaultChannel === 'webhook' ? 'email' : defaultChannel,
    webhook_id: null,
    frequency,
    time_hhmm: time,
    day_of_week: frequency === 'weekly' ? day_of_week : null,
    day_of_month: frequency === 'monthly' ? day_of_month : null,
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
  let channel: NagChannel =
    typeof raw.channel === 'string' && isNagChannel(raw.channel) ? raw.channel : defaultChannel;
  if (channel === 'webhook') channel = defaultChannel === 'webhook' ? 'email' : defaultChannel;

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
    webhook_id: null,
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
  defaultChannel: NagChannel,
  profileTimeZone: string
): Promise<ParseDraft> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fallbackDraft(text, defaultChannel);
  }

  const model = process.env.OPENAI_NAG_PARSE_MODEL || 'gpt-4o-mini';
  const system = buildSystem(profileTimeZone);

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
          { role: 'system', content: system },
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

    const bodyRaw = openAiJsonToBody(parsed, defaultChannel);
    if (!(typeof bodyRaw.message === 'string' && bodyRaw.message.trim())) {
      bodyRaw.message =
        extractTaskMessage(text).trim() || text.trim().slice(0, 200) || 'Reminder';
    }
    const grounded = applyHeuristicGrounding(text, bodyRaw as GroundingBody);
    const validated = validateScheduleBody({ ...grounded, webhook_id: null });
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
