// app/api/topics/route.ts — Supabase-backed topics API (falls back to local JSON)
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY || "";

function getSupabase() {
  if (SUPABASE_URL && SUPABASE_ANON) {
    return createClient(SUPABASE_URL, SUPABASE_ANON);
  }
  return null;
}

function getSupabaseAdmin() {
  if (SUPABASE_URL && SUPABASE_SERVICE) {
    return createClient(SUPABASE_URL, SUPABASE_SERVICE);
  }
  return null;
}

// In-memory fallback topic store (dev/testing without Supabase)
let topicsCache: Array<{
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
}> = [];

const QUEUE_PATH = path.join("/home/mazin/projects/research", "topic-queue.json");

function loadLocalTopicsSync() {
  try {
    if (fs.existsSync(QUEUE_PATH)) {
      const raw = fs.readFileSync(QUEUE_PATH, "utf-8");
      const data = JSON.parse(raw);
      topicsCache = (Array.isArray(data) ? data : (data.topics || [])).map((t: any) => ({
        id: t.id || Math.random().toString(36).slice(2),
        title: t.title || "",
        description: t.description || "",
        source: t.source || "",
        source_name: t.source_name || "",
        url: t.url || "",
        votes: t.votes || 0,
        category: t.category || "AI",
        created_at: t.created_at || new Date().toISOString(),
        updated_at: t.updated_at || new Date().toISOString(),
        notes: t.notes || "",
        status: t.status || "queued",
      }));
    }
  } catch (e) {
    console.error("Failed to load local topics:", e);
  }
}
loadLocalTopicsSync();

function saveLocalTopicsSync() {
  try {
    const data = { topics: topicsCache, updated_at: new Date().toISOString() };
    fs.writeFileSync(QUEUE_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Failed to save local topics:", e);
  }
}

async function getTopics() {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("topics")
      .select("*")
      .eq("status", "queued")
      .order("votes", { ascending: false })
      .order("created_at", { ascending: false });
    if (!error && data) {
      return data.map((d: any) => ({
        id: d.id,
        title: d.title,
        description: d.description,
        source: d.source,
        source_name: d.source_name,
        url: d.url,
        votes: d.votes || 0,
        category: d.category,
        created_at: d.created_at,
        updated_at: d.updated_at,
        notes: d.notes || "",
        status: d.status,
      }));
    }
  }
  loadLocalTopicsSync();
  return topicsCache;
}

async function saveTopic(topic: any) {
  const sbAdmin = getSupabaseAdmin();
  if (sbAdmin) {
    const { data, error } = await sbAdmin
      .from("topics")
      .insert([{
        id: topic.id,
        title: topic.title,
        description: topic.description || "",
        source: topic.source || "user",
        source_name: "user",
        url: topic.url || "",
        votes: 0,
        category: topic.category || "AI",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: topic.notes || "",
        status: "queued",
      }])
      .select()
      .single();
    if (!error && data) return { topic: data as any, status: 201 };
  }
  topicsCache.unshift({
    id: topic.id,
    title: topic.title,
    description: topic.description || "",
    source: topic.source || "user",
    source_name: "user",
    url: topic.url || "",
    votes: 0,
    category: topic.category || "AI",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    notes: topic.notes || "",
    status: "queued",
  });
  saveLocalTopicsSync();
  return { topic: topicsCache[0], status: 201 };
}

async function vote(topicId: string, clientId: string) {
  const sbAdmin = getSupabaseAdmin();
  if (sbAdmin) {
    const { data: existing } = await sbAdmin
      .from("topic_votes")
      .select("id")
      .eq("topic_id", topicId)
      .eq("client_id", clientId)
      .single();
    if (existing) return { error: "Already voted", status: 409 };

    const { data: cur } = await sbAdmin
      .from("topics")
      .select("votes")
      .eq("id", topicId)
      .single() as { data: { votes: number } | null; error: any };

    if (!cur) return { error: "Topic not found", status: 404 };

    const newVotes = (cur as any).votes + 1;
    await sbAdmin
      .from("topics")
      .update({ votes: newVotes, updated_at: new Date().toISOString() })
      .eq("id", topicId);

    await sbAdmin.from("topic_votes").insert({
      topic_id: topicId,
      client_id: clientId,
      created_at: new Date().toISOString(),
    });

    const { data: topic } = await sbAdmin
      .from("topics")
      .select("*")
      .eq("id", topicId)
      .single();

    return { topic };
  }

  const idx = topicsCache.findIndex(t => t.id === topicId);
  if (idx === -1) return { error: "Topic not found", status: 404 };
  topicsCache[idx].votes += 1;
  topicsCache[idx].updated_at = new Date().toISOString();
  saveLocalTopicsSync();
  return { topic: topicsCache[idx] };
}

export async function GET() {
  const topics = await getTopics();
  return NextResponse.json({ topics });
}

export async function POST(req: Request) {
  const body = await req.json();
  const clientId = req.headers.get("x-client-id") || Math.random().toString(36).slice(2);

  if (body.action === "vote") {
    const result = await vote(body.id, clientId);
    return NextResponse.json(result, { status: result.status || 200 });
  }

  if (body.action === "submit") {
    const result = await saveTopic({
      id: Math.random().toString(36).slice(2, 10),
      title: body.title,
      url: body.url || "",
      description: "",
      category: body.category || "AI",
      notes: body.notes || "",
    });
    return NextResponse.json(result, { status: result.status || 201 });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
