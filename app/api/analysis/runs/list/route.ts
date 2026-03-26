import { NextResponse } from "next/server";
import { tryDeriveUserIdFromToken } from "@/lib/user-id";
import { isAnalysisDatabaseReady } from "@/services/database/registry";
import { getAnalysisHistory } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string };
    const token = body.token?.trim();
    if (!token) {
      return NextResponse.json({ error: "token required" }, { status: 400 });
    }
    if (!isAnalysisDatabaseReady()) {
      return NextResponse.json({ enabled: false, runs: [] });
    }
    const userId = tryDeriveUserIdFromToken(token);
    if (!userId) {
      return NextResponse.json({ enabled: false, runs: [] });
    }
    const runs = await getAnalysisHistory(userId, 24);
    return NextResponse.json({ enabled: true, runs });
  } catch (e) {
    console.error("[API] analysis/runs/list:", e);
    return NextResponse.json({ error: "Failed to list runs" }, { status: 500 });
  }
}
