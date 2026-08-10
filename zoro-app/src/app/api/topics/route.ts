// app/api/topics/route.ts
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

// Read current topics from file
async function readTopics(): Promise<Topic[]> {
  try {
    const content = await fs.readFile(TOPICS_JSON, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

// Write topics back to file
async function writeTopics(topics: Topic[]): Promise<void> {
  const dir = path.dirname(TOPICS_JSON);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(TOPICS_JSON, JSON.stringify(topics, null, 2), "utf-8");
}

export async function GET() {
  const topics = await readTopics();
  return NextResponse.json({ topics, count: topics.length });
}

export async function POST(request: Request) {
  const body = await request.json();
  const action = body.action as string;

  if (action === "vote") {
    const { id }: { id: string } = body;
    const topics = await readTopics();
    const topic = topics.find((t) => t.id === id && t.status === "active");

    if (!topic) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    topic.votes += 1;
    topic.updated_at = new Date().toISOString();
    await writeTopics(topics);
    return NextResponse.json({ topic: { id: topic.id, votes: topic.votes } });
  }

  if (action === "submit") {
    const { title, url, notes }: { title: string; url?: string; notes?: string } = body;

    if (!title || title.length < 5) {
      return NextResponse.json({ error: "Title must be at least 5 characters" }, { status: 400 });
    }

    const topics = await readTopics();

    // Generate ID from title
    const id = "user-submit-" + Buffer.from(title + Date.now()).toString("base64url").slice(0, 16);
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

    const newTopic: Topic = {
      id,
      title: title.trim(),
      description: title.trim(),
      source: "user",
      source_name: "Community",
      url: url || "",
      votes: 1, // User gets 1 vote on their own submission
      category: "general",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: notes || "",
      status: "active",
    };

    topics.push(newTopic);
    // Sort by votes desc
    topics.sort((a, b) => b.votes - a.votes || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    await writeTopics(topics);
    return NextResponse.json({ topic: newTopic });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
