// app/api/experiments/route.ts — Serve ideas data
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const IDEAS_FILE = path.join(__dirname, "..", "..", "..", "experiments", "ideas.json");

export async function GET() {
  try {
    const data = await fs.readFile(IDEAS_FILE, "utf-8");
    const experiments = JSON.parse(data);
    return NextResponse.json({ experiments });
  } catch (e) {
    console.error("Failed to load ideas:", e);
    return NextResponse.json({ experiments: [] });
  }
}
