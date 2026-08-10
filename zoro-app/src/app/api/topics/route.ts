// app/api/topics/route.ts — Supabase-only topics API
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

async function getTopics() {
  const sb = getSupabase();
  if (!sb) return { topics: [], ready: false };
  try {
    const { data, error } = await sb
      .from("topics")
      .select("*")
      .eq("status", "queued")
      .order("votes", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      if (error.code === "42P01" || error.message?.includes("not exist")) {
        return { topics: [], ready: false, error: "topics table not yet initialized" };
      }
      return { topics: [], error: error.message, ready: true };
    }
    return {
      topics: (data || []).map((d: any) => ({
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
      })),
      ready: true,
    };
  } catch (e: any) {
    return { topics: [], error: e.message, ready: true };
  }
}

async function saveTopic(topic: any) {
  const sbAdmin = getSupabaseAdmin();
  if (!sbAdmin) return { error: "Supabase unavailable", status: 500 };
  try {
    const { data, error } = await sbAdmin
      .from("topics")
      .insert([{
        id: topic.id,
        title: topic.title,
        description: topic.description || "",
        source: topic.source || "user",
        source_name: topic.source_name || "user",
        source_url: topic.source_url || "",
        url: topic.url || "",
        votes: 0,
        category: topic.category || "AI",
        notes: topic.notes || "",
        status: "queued",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();
    if (error) {
      if (error.code === "42P01" || error.message?.includes("not exist")) {
        return { error: "topics table not yet initialized — run migration first", status: 503 };
      }
      return { error: error.message, status: 500 };
    }
    return { topic: data as any, status: 201 };
  } catch (e: any) {
    return { error: e.message, status: 500 };
  }
}

async function vote(topicId: string, clientId: string) {
  const sbAdmin = getSupabaseAdmin();
  if (!sbAdmin) return { error: "Supabase unavailable", status: 500 };
  try {
    const { data: existing, error: err1 } = await sbAdmin
      .from("topic_votes")
      .select("id")
      .eq("topic_id", topicId)
      .eq("client_id", clientId)
      .single();
    if (err1 && err1.code !== "PGRST116") return { error: err1.message, status: 500 };
    if (existing) return { error: "Already voted", status: 409 };

    const { data: cur, error: err2 } = await sbAdmin
      .from("topics")
      .select("votes")
      .eq("id", topicId)
      .single();
    if (err2 || !cur) return { error: "Topic not found", status: 404 };

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
  } catch (e: any) {
    return { error: e.message, status: 500 };
  }
}

export async function GET() {
  const result = await getTopics();
  if (result.error && !result.ready) {
    return NextResponse.json({ topics: [], ready: false, message: result.error }, { status: 503 });
  }
  return NextResponse.json({ topics: result.topics, ready: true, message: result.error || undefined });
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
      source: body.source || "user",
      source_name: body.source_name || "user",
      description: "",
      category: body.category || "AI",
      notes: body.notes || "",
    });
    return NextResponse.json(result, { status: result.status || 201 });
  }

  if (body.action === "bulk_upsert") {
    const { topics: newTopics } = body;
    if (!Array.isArray(newTopics) || newTopics.length === 0) {
      return NextResponse.json({ error: "No topics provided", status: 400 });
    }
    const sbAdmin = getSupabaseAdmin();
    if (!sbAdmin) return NextResponse.json({ error: "Supabase unavailable", status: 500 });

    const inserted: any[] = [];
    for (const t of newTopics) {
      try {
        const { data: existing } = await sbAdmin
          .from("topics")
          .select("id, votes")
          .eq("id", t.id)
          .single();

        if (existing) {
          const { data: updated } = await sbAdmin
            .from("topics")
            .update({
              title: t.title,
              description: t.description || "",
              source: t.source || "agent",
              source_name: t.source_name || "",
              source_url: t.source_url || "",
              url: t.url || "",
              category: t.category || "AI",
              notes: t.notes || "",
              status: "queued",
              updated_at: new Date().toISOString(),
            })
            .eq("id", t.id)
            .select()
            .single();
          if (updated) inserted.push(updated);
        } else {
          const { data: inserted_t } = await sbAdmin
            .from("topics")
            .insert([{
              id: t.id,
              title: t.title,
              description: t.description || "",
              source: t.source || "agent",
              source_name: t.source_name || "",
              source_url: t.source_url || "",
              url: t.url || "",
              votes: t.votes || 0,
              category: t.category || "AI",
              notes: t.notes || "",
              status: "queued",
              created_at: t.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }])
            .select()
            .single();
          if (inserted_t) inserted.push(inserted_t);
        }
      } catch (e: any) {
        console.error(`bulk_upsert failed for ${t.id}:`, e.message);
      }
    }

    return NextResponse.json({
      upserted: inserted.length,
      topics: inserted,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
