import { NextResponse } from "next/server";
import { tryDeriveUserIdFromToken } from "@/lib/user-id";
import {
  listCommitsIngestedSince,
  getTenantAiQueue,
  isAnalysisDbConfigured,
} from "@/lib/db";

export const runtime = "nodejs";

/**
 * Poll new webhook-ingested commits for the navbar. POST { token, sinceIso, lastKnownAiBatchVersion? }
 */
export async function POST(request: Request) {
  try {
    if (!isAnalysisDbConfigured()) {
      return NextResponse.json({ enabled: false, commits: [] });
    }

    const body = (await request.json()) as {
      token?: string;
      sinceIso?: string;
      lastKnownAiBatchVersion?: number;
    };
    const token = body.token?.trim();
    if (!token) {
      return NextResponse.json({ error: "token required" }, { status: 400 });
    }

    const userId = tryDeriveUserIdFromToken(token);
    if (!userId) {
      return NextResponse.json({ error: "USER_ID_PEPPER not configured" }, { status: 503 });
    }

    const sinceIso =
      typeof body.sinceIso === "string" && body.sinceIso.trim()
        ? body.sinceIso.trim()
        : new Date(0).toISOString();

    const commits = await listCommitsIngestedSince(userId, sinceIso, 50);
    const queue = await getTenantAiQueue(userId);
    const aiBatchVersion = queue?.ai_batch_version ?? 0;
    const lastKnown =
      typeof body.lastKnownAiBatchVersion === "number" && Number.isFinite(body.lastKnownAiBatchVersion)
        ? body.lastKnownAiBatchVersion
        : -1;

    const analysisVersionBumped = lastKnown >= 0 && aiBatchVersion > lastKnown;

    return NextResponse.json({
      enabled: true,
      commits,
      aiBatchVersion,
      analysisVersionBumped,
    });
  } catch (e) {
    console.error("[commits/notifications]", e);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
