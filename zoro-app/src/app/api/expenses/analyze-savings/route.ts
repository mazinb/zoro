import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const LOG_PREFIX = '[analyze-savings]';

function preview(s: string, max = 80): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max) + '...';
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Server missing GEMINI_API_KEY' }, { status: 500 });
  }

  let body: {
    estimated?: Record<string, number>;
    actual?: Record<string, number>;
    currency?: string;
    name?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { estimated = {}, actual = {}, currency = '$', name } = body;
  const categories = ['housing', 'food', 'transportation', 'healthcare', 'entertainment', 'other'] as const;
  const labels: Record<string, string> = {
    housing: 'Housing & Utilities',
    food: 'Food & Dining',
    transportation: 'Transportation',
    healthcare: 'Healthcare & Insurance',
    entertainment: 'Entertainment & Leisure',
    other: 'Other',
  };

  const lines = categories
    .filter((c) => {
      const est = typeof estimated[c] === 'number' ? estimated[c] : 0;
      const act = typeof actual[c] === 'number' ? actual[c] : 0;
      return est > 0 || act > 0;
    })
    .map((c) => {
      const est = typeof estimated[c] === 'number' ? estimated[c] : 0;
      const act = typeof actual[c] === 'number' ? actual[c] : 0;
      return `${labels[c]}: estimated ${currency}${est.toLocaleString()}, actual ${currency}${act.toLocaleString()}`;
    })
    .join('; ');

  if (!lines.trim()) {
    return NextResponse.json({ data: { report: 'No expense categories with data to analyze. Add estimates or upload statements with expenses.' } });
  }

  const namePart = name && typeof name === 'string' && name.trim() ? ` The person's name is ${name.trim()}.` : '';
  const prompt = `You are writing a short savings report directly TO the person (use "you" and "your").${namePart} Their estimated vs actual expenses: ${lines}. Write 3–5 sentences, conversational and friendly, on where they can save money. Be specific and to the point. Address them directly (e.g. "You could...", "Your spending on..."). Plain text only, no bullets or headers.`;

  console.log(`${LOG_PREFIX} Input: overall analyze, currency=${currency}`);
  console.log(`${LOG_PREFIX} Calling generateContent: prompt ${prompt.length} chars`);

  const ai = new GoogleGenAI({ apiKey });
  let response;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: { maxOutputTokens: 512 },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Analysis failed';
    console.log(`${LOG_PREFIX} LLM error: ${message}`);
    return NextResponse.json({ error: `Analysis failed: ${message}` }, { status: 502 });
  }

  const text = response.text?.trim() ?? '';
  console.log(`${LOG_PREFIX} LLM out: ${text.length} chars, preview: "${preview(text)}"`);
  console.log(`${LOG_PREFIX} Done → returning { data: { report } }`);

  return NextResponse.json({ data: { report: text } });
}
