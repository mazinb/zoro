/**
 * Deterministic hints from free text — used to ground LLM / fallback parsing (weekdays, time, task line).
 */

const DAY_RULES: { re: RegExp; dow: number }[] = [
  { re: /\b(?:monday|mondays|mon\.?)\b/i, dow: 0 },
  { re: /\b(?:tuesday|tuesdays|tues?\.?)\b/i, dow: 1 },
  { re: /\b(?:wednesday|wednesdays|wed\.?)\b/i, dow: 2 },
  { re: /\b(?:thursday|thursdays|thurs?\.?|thur\.?)\b/i, dow: 3 },
  { re: /\b(?:friday|fridays|fri\.?)\b/i, dow: 4 },
  { re: /\b(?:saturday|saturdays|sat\.?)\b/i, dow: 5 },
  { re: /\b(?:sunday|sundays|sun\.?)\b/i, dow: 6 },
];

/** 0 = Monday … 6 = Sunday (matches API / DB). */
export function extractDayOfWeekFromText(text: string): number | null {
  for (const { re, dow } of DAY_RULES) {
    if (re.test(text)) return dow;
  }
  return null;
}

/**
 * Strip trailing schedule phrase so the task is e.g. "mow the lawn" not "mow the lawn every tuesday".
 */
export function extractTaskMessage(text: string): string {
  const s = text.trim();
  const cut = s.search(
    /\s+(?:every|each|on)\s+(?:the\s+)?(?:monday|mondays|tuesday|tuesdays|tues|tue|wednesday|wednesdays|wed|thursday|thursdays|thurs|thu|thur|friday|fridays|fri|saturday|saturdays|sat|sunday|sundays|sun)\b/i
  );
  if (cut > 0) {
    const head = s.slice(0, cut).trim();
    if (head.length > 0) return head;
  }
  return s;
}

const TIME_PATTERNS: { re: RegExp; toHHMM: (m: RegExpMatchArray) => string | null }[] = [
  {
    re: /\b(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?\b/i,
    toHHMM(m) {
      let h = parseInt(m[1], 10);
      const min = parseInt(m[2], 10);
      const ap = m[3]?.toLowerCase();
      if (ap === 'pm' && h < 12) h += 12;
      if (ap === 'am' && h === 12) h = 0;
      if (h < 0 || h > 23 || min < 0 || min > 59) return null;
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    },
  },
  {
    re: /\b(?:at\s+)?(\d{1,2})\s*(am|pm)\b/i,
    toHHMM(m) {
      let h = parseInt(m[1], 10);
      const ap = m[2]?.toLowerCase();
      if (!ap) return null;
      if (ap === 'pm' && h < 12) h += 12;
      if (ap === 'am' && h === 12) h = 0;
      if (h < 0 || h > 23) return null;
      return `${String(h).padStart(2, '0')}:00`;
    },
  },
];

/** Returns HH:MM if user clearly stated a time; otherwise null. */
export function extractTimeHHMMFromText(text: string): string | null {
  for (const { re, toHHMM } of TIME_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const t = toHHMM(m);
      if (t) return t;
    }
  }
  return null;
}

export type FrequencyHint = 'daily' | 'weekly' | 'monthly' | 'once';

export function extractFrequencyHint(text: string): FrequencyHint | null {
  const t = text.toLowerCase();
  if (/\b(?:every|each)\s+day\b/.test(t) || /\bdaily\b/.test(t) || /\bevery\s+morning\b/.test(t)) {
    return 'daily';
  }
  if (/\b(?:once|one\s*time|single)\b/.test(t) && /\b\d{4}-\d{2}-\d{2}\b/.test(text)) {
    return 'once';
  }
  if (/\bmonthly\b/.test(t) || /\b(?:every|each)\s+month\b/.test(t)) {
    return 'monthly';
  }
  if (extractDayOfWeekFromText(text) !== null) {
    return 'weekly';
  }
  if (/\b(?:every|each)\s+week\b/.test(t) || /\bweekly\b/.test(t)) {
    return 'weekly';
  }
  return null;
}

type GroundingBody = {
  message: string;
  channel: string;
  frequency: string;
  time_hhmm: string;
  day_of_week: number | null;
  day_of_month: number | null;
  end_type: string;
  until_date: string | null;
  occurrences_max: number | null;
};

/**
 * Prefer weekday / time / task line from raw user text when the model skipped them or echoed the whole sentence.
 */
export function applyHeuristicGrounding(rawText: string, body: GroundingBody): GroundingBody {
  const out = { ...body };
  const freqHint = extractFrequencyHint(rawText);
  const dow = extractDayOfWeekFromText(rawText);

  if (freqHint === 'daily') {
    out.frequency = 'daily';
    out.day_of_week = null;
  } else if (dow !== null) {
    out.frequency = 'weekly';
    out.day_of_week = dow;
    const refined = extractTaskMessage(rawText);
    if (refined.length > 0) {
      out.message = refined.length > 200 ? `${refined.slice(0, 197)}…` : refined;
    }
  }

  const explicitTime = extractTimeHHMMFromText(rawText);
  if (explicitTime) {
    out.time_hhmm = explicitTime;
  }

  return out;
}
