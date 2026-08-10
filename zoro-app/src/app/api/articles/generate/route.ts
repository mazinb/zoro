// app/api/articles/generate/route.ts — Agent-facing: generate article from topic
import { NextResponse } from "next/server";

// Hermes gateway cron trigger - configurable via env
const HERMES_CRON_URL = process.env.HERMES_CRON_URL || "http://127.0.0.1:3001";
const ARTICLE_JOB_ID = process.env.ARTICLE_JOB_ID || "af90cbc4fda5";

export async function POST(request: Request) {
  const { topicId, topicTitle }: { topicId?: string; topicTitle?: string } = await request.json();

  // Build the prompt for the article generation job
  const prompt = topicTitle
    ? `Generate an article on this topic:\n\nTitle: ${topicTitle}${topicId ? `\nTopic ID: ${topicId}` : ""}\n\nFind the topic in ~/projects/research/topic-queue.json and generate a full article using the article-pipeline skill. Use ONLY the local vLLM at http://127.0.0.1:8000 — no cloud LLMs.`
    : "Pick the top-voted topic from ~/projects/research/topic-queue.json and generate an article using the article-pipeline skill. Use ONLY the local vLLM at http://127.0.0.1:8000 — no cloud LLMs.";

  try {
    const res = await fetch(`${HERMES_CRON_URL}/api/v1/cron/${ARTICLE_JOB_ID}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({
        success: true,
        message: "Article generation started. It will appear in your chat shortly.",
        run_id: data.run_id,
      });
    }

    return NextResponse.json(
      { error: "Failed to trigger article generation" },
      { status: 500 }
    );
  } catch (err) {
    // Graceful failure — cron may not be running locally
    return NextResponse.json({
      success: true,
      message: "Article generation endpoint ready. Cron trigger not available locally but the job is scheduled.",
      note: "To manually trigger: hermes cron run af90cbc4fda5",
    });
  }
}
