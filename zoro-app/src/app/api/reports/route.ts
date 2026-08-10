// app/api/reports/route.ts
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const REPORTS_DIR = path.join(process.cwd(), "src", "reports");

interface ReportMeta {
  slug: string;
  title: string;
  date: string;
  category: string;
  summary: string;
}

export async function GET() {
  try {
    const files = await fs.readdir(REPORTS_DIR);
    const metas: ReportMeta[] = [];

    for (const file of files) {
      // Skip iteration metadata and non-report JSON files
      if (!file.endsWith(".json") || file.endsWith("-iteration.json")) continue;
      
      const content = await fs.readFile(path.join(REPORTS_DIR, file), "utf-8");
      try {
        const meta: ReportMeta = JSON.parse(content);
        metas.push(meta);
      } catch {
        // skip malformed JSON
      }
    }

    // Sort by date descending
    metas.sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({ reports: metas });
  } catch {
    return NextResponse.json({ reports: [] });
  }
}
