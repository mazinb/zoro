// app/api/reports/[slug]/route.ts
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { marked } from "marked";

const REPORTS_DIR = path.join(process.cwd(), "src", "reports");

interface ReportMeta {
  slug: string;
  title: string;
  date: string;
  category: string;
  summary: string;
  qualityGates?: {
    minWordCount?: number;
    minCitations?: number;
    hasCounterargument?: boolean;
    hasCallToAction?: boolean;
    noHallucinatedClaims?: boolean;
  };
}

interface IterationMeta {
  rounds: {
    round: number;
    type: "review" | "revision" | "published";
    status: "FAIL" | "PASS" | "APPLIED" | "PUBLISH";
    score?: number;
    date: string;
    summary: string;
    verdict?: string;
    dimensions?: Record<string, number>;
    kills?: string[];
    fixes?: string[];
    changes?: string[];
  }[];
}

interface ReportData {
  meta: ReportMeta;
  html: string;
  iteration?: IterationMeta;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const [metaRes, contentRes, iterationRes] = await Promise.all([
      fs.readFile(path.join(REPORTS_DIR, `${slug}.json`), "utf-8"),
      fs.readFile(path.join(REPORTS_DIR, `${slug}.md`), "utf-8"),
      fs.readFile(path.join(REPORTS_DIR, `${slug}-iteration.json`), "utf-8").catch(() => null),
    ]);

    const meta: ReportMeta = JSON.parse(metaRes);
    const content = contentRes;

    marked.setOptions({
      breaks: true,
      gfm: true,
    });
    const html = marked.parse(content) as string;

    let iteration: IterationMeta | undefined;
    if (iterationRes) {
      const iterationData = JSON.parse(iterationRes);
      if (iterationData?.rounds?.length) {
        iteration = iterationData;
      }
    }

    return NextResponse.json({ report: { meta, html, iteration } });
  } catch (err) {
    console.error("Failed to load report:", err);
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
}
