import { NextResponse } from "next/server";
import { tryDeriveUserIdFromToken } from "@/lib/user-id";
import { isAnalysisDatabaseReady } from "@/services/database/registry";
import { getAnalysisRunSnapshotForUser } from "@/services/runService";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string; runId?: string };
    const token = body.token?.trim();
    const runId = body.runId?.trim();
    if (!token || !runId) {
      return NextResponse.json({ error: "token and runId required" }, { status: 400 });
    }
    if (!isAnalysisDatabaseReady()) {
      return NextResponse.json({ success: false, error: "Database persistence disabled" }, { status: 400 });
    }
    const userId = tryDeriveUserIdFromToken(token);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Invalid persistence config" }, { status: 400 });
    }
    const result = await getAnalysisRunSnapshotForUser(userId, runId);
    if (!result) {
      return NextResponse.json({ success: false, error: "Run not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, result });
  } catch (e) {
    console.error("[API] analysis/runs/restore:", e);
    return NextResponse.json({ success: false, error: "Restore failed" }, { status: 500 });
  }
}
