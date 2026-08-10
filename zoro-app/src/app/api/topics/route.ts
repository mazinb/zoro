// app/api/topics/route.ts
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const TOPICS_JSON = path.join(process.cwd(), "public", "api", "topics.json");
const ARCHIVE_JSON = path.join(process.cwd(), "public", "api", "topics-archive.json");

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

// Read archive
async function readArchive(): Promise<any[]> {
  try {
    const content = await fs.readFile(ARCHIVE_JSON, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

// Write archive
async function writeArchive(archive: any[]): Promise<void> {
  const dir = path.dirname(ARCHIVE_JSON);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(ARCHIVE_JSON, JSON.stringify(archive, null, 2), "utf-8");
}

// Auto-archive expired topics (older than 5 days)
async function archiveExpired(): Promise<Topic[]> {
  const topics = await readTopics();
  const now = Date.now();
  const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
  let changed = false;

  const active: Topic[] = [];
  const expired: Topic[] = [];

  for (const topic of topics) {
    const created = new Date(topic.created_at).getTime();
    if (topic.status === "active" && now - created >= FIVE_DAYS_MS) {
      expired.push({ ...topic, status: "expired" });
      changed = true;
    } else {
      active.push(topic);
    }
  }

  if (changed && expired.length > 0) {
    // Archive expired topics
    const archive = await readArchive();
    for (const t of expired) {
      archive.push({
        ...t,
        archived_at: new Date().toISOString(),
        archived_reason: "expired",
      });
    }
    await writeArchive(archive);
    await writeTopics(active);
  }

  return active;
}

export async function GET() {
  const topics = await archiveExpired(); // Auto-archive expired on every read
  return NextResponse.json({ topics, count: topics.length });
}

export async function POST(request: Request) {
  const body = await request.json();
  const action = body.action as string;

  // Sync expired topics before any write operation
  await archiveExpired();

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
    const { title, url, notes, category }: { title: string; url?: string; notes?: string; category?: string } = body;

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
      category: category || "general",
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
