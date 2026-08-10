// app/api/topics/votes/route.ts — Agent-facing: get topic votes for selection
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

// Local fallback
const QUEUE_PATH = path.join("/home/mazin/projects/research", "topic-queue.json");

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

export async function GET() {
  // Try Supabase first
  const sbAdmin = getSupabaseAdmin();
  if (sbAdmin) {
    const { data } = await sbAdmin
      .from("topics")
      .select("*, topic_votes(count)")
      .eq("status", "active")
      .eq("source", "agent")
      .order("created_at", { ascending: false });

    if (data) {
      const topicsWithVotes = data.map((t: any) => ({
        ...t,
        vote_count: t.topic_votes?.[0]?.count || 0,
      }));
      return NextResponse.json({
        topics: topicsWithVotes,
        count: topicsWithVotes.length,
      });
    }
  }

  // Fallback to local
  loadLocalTopicsSync();
  return NextResponse.json({
    topics: topicsCache.sort((a, b) => b.votes - a.votes || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    count: topicsCache.length,
  });
}
