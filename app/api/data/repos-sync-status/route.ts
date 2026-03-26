import { NextResponse } from "next/server";
import { getRepoLastSyncedAtMap, getUserId, isAnalysisDbConfigured } from "@/lib/db";
import type { RepoConfig } from "@/lib/types";

export const runtime = "nodejs";

/** Returns `last_synced_at` per `owner/repo` for the dashboard repo list. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string; repos?: RepoConfig[] };
    const token = body.token?.trim();
    const repos = body.repos;
    if (!token || !repos?.length) {
      return NextResponse.json({ error: "token and repos required" }, { status: 400 });
    }
    if (!isAnalysisDbConfigured()) {
      return NextResponse.json({ enabled: false, syncAt: {} });
    }
    const userId = getUserId(token);
    if (!userId) {
      return NextResponse.json({ enabled: false, syncAt: {} });
    }
    const keys = repos.map((r) => `${r.owner}/${r.repo}`);
    const syncAt = await getRepoLastSyncedAtMap(userId, keys);
    return NextResponse.json({ enabled: true, syncAt });
  } catch (e) {
    console.error("[API] repos-sync-status:", e);
    return NextResponse.json({ error: "Failed to load sync status" }, { status: 500 });
  }
}
