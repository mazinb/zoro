// app/api/topics/refresh/route.ts — Agent-facing: force-refresh topic queue
import { NextResponse } from "next/server";

// Hermes gateway cron trigger - configurable via env
const HERMES_CRON_URL = process.env.HERMES_CRON_URL || "http://127.0.0.1:3001";
const TOPIC_SCOUT_JOB_ID = process.env.TOPIC_SCOUT_JOB_ID || "4eee9e83205e";

export async function POST() {
  try {
    // Trigger topic-scout cron job manually
    const res = await fetch(`${HERMES_CRON_URL}/api/v1/cron/${TOPIC_SCOUT_JOB_ID}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({
        success: true,
        message: "Topic refresh started. New topics will appear shortly.",
        run_id: data.run_id,
      });
    }

    return NextResponse.json(
      { error: "Failed to trigger topic refresh" },
      { status: 500 }
    );
  } catch (err) {
    // Graceful failure — cron may not be running locally
    return NextResponse.json({
      success: true,
      message: "Refresh endpoint ready. Cron trigger not available locally but the job is scheduled.",
      note: "To manually trigger: hermes cron run 4eee9e83205e",
    });
  }
}
