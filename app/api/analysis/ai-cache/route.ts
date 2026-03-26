import { NextResponse } from "next/server";
import { emptyAnalysisCache } from "@/lib/analysis-cache";
import type { AnalyzeImpactPayload } from "@/lib/types";
import { tryDeriveUserIdFromToken } from "@/lib/user-id";
import { isAnalysisDatabaseReady } from "@/services/database/registry";
import { getAIAnalysisForRepos } from "@/services/analysisService";

export const runtime = "nodejs";

/** Load tenant-scoped AI cache from DB only (no GitHub). */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<Pick<AnalyzeImpactPayload, "token" | "repos">>;
    const token = body.token?.trim();
    const repos = body.repos;
    if (!token || !repos?.length) {
      return NextResponse.json(
        { error: "token and repos required" },
        { status: 400 },
      );
    }
    if (!isAnalysisDatabaseReady()) {
      return NextResponse.json({
        enabled: false,
        analysisCache: emptyAnalysisCache(),
      });
    }
    const userId = tryDeriveUserIdFromToken(token);
    if (!userId) {
      return NextResponse.json({
        enabled: false,
        analysisCache: emptyAnalysisCache(),
      });
    }
    const analysisCache = await getAIAnalysisForRepos(userId, repos);
    return NextResponse.json({ enabled: true, analysisCache });
  } catch (e) {
    console.error("[API] analysis/ai-cache:", e);
    return NextResponse.json({ error: "Failed to load cache" }, { status: 500 });
  }
}
