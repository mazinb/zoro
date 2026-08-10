// app/api/topics/submit/route.ts
// One-off manual trigger to add topics via API without needing a browser.
// POST /api/topics/submit with { title, url, notes }
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const TOPICS_JSON = path.join(process.cwd(), "public", "api", "topics.json");

interface Topic {
  id: string;
  title: string;
  description: string;
  source: string;
  source_name: string;
  url: string;
  votes: number;
  category: string;
  created_at: string;
  updated_at: string;
  notes: string;
  status: string;
}

async function readTopics(): Promise<Topic[]> {
  try {
    const content = await fs.readFile(TOPICS_JSON, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function writeTopics(topics: Topic[]): Promise<void> {
  const dir = path.dirname(TOPICS_JSON);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(TOPICS_JSON, JSON.stringify(topics, null, 2), "utf-8");
}

export async function POST(request: Request) {
  const body = await request.json();
  const { title, url, notes, category }: { title: string; url?: string; notes?: string; category?: string } = body;

  if (!title || title.length < 5) {
    return NextResponse.json({ error: "Title must be at least 5 characters" }, { status: 400 });
  }

  const topics = await readTopics();

  // Generate unique ID
  const id = "manual-" + Buffer.from(title + Date.now() + Math.random()).toString("base64url").slice(0, 20);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  const newTopic: Topic = {
    id,
    title: title.trim(),
    description: title.trim(),
    source: "manual",
    source_name: "Manual",
    url: url || "",
    votes: 1,
    category: category || "general",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    notes: notes || "",
    status: "active",
  };

  topics.push(newTopic);
  topics.sort((a, b) => b.votes - a.votes);
  await writeTopics(topics);

  return NextResponse.json({ topic: newTopic, message: "Topic added to queue" });
}
