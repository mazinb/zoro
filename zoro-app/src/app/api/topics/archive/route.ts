// app/api/topics/archive/route.ts — internal only, no UI
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

interface ArchivedTopic extends Topic {
  archived_at: string;
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
  await fs.writeFile(TOPICS_JSON, JSON.stringify(topics, null, 2), "utf-8");
}

async function readArchive(): Promise<ArchivedTopic[]> {
  try {
    const content = await fs.readFile(ARCHIVE_JSON, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function writeArchive(archive: ArchivedTopic[]): Promise<void> {
  await fs.writeFile(ARCHIVE_JSON, JSON.stringify(archive, null, 2), "utf-8");
}

export async function POST(request: Request) {
  const { id }: { id: string } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const topics = await readTopics();
  const topic = topics.find((t) => t.id === id);
  if (!topic) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Remove from active queue
  const remaining = topics.filter((t) => t.id !== id);
  await writeTopics(remaining);

  // Archive it
  const archive = await readArchive();
  archive.push({ ...topic, status: "archived", archived_at: new Date().toISOString() });
  await writeArchive(archive);

  return NextResponse.json({ ok: true });
}
