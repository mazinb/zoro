// app/api/topics/votes/route.ts — Supabase-only: get topic votes
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY || "";

function getSupabaseAdmin() {
  if (SUPABASE_URL && SUPABASE_SERVICE) {
    return createClient(SUPABASE_URL, SUPABASE_SERVICE);
  }
  return null;
}

export async function GET() {
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
  return NextResponse.json({ topics: [], count: 0 });
}
