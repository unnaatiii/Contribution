import { NextResponse } from "next/server";
import { GitHubService } from "@/lib/github-service";
import { ScoringEngine } from "@/lib/scoring-engine";
import { getOpenRouterApiKey } from "@/lib/openrouter-key";
import {
  endOfDayUtcIso,
  startOfDayUtcIso,
  validateAnalysisDateRange,
} from "@/lib/date-range";
import type { AnalyzeImpactPayload } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<AnalyzeImpactPayload>;
    const { token, repos, dateFrom, dateTo } = body;

    if (!token || !repos?.length) {
      return NextResponse.json(
        { error: "GitHub token and at least one repo required" },
        { status: 400 },
      );
    }

    if (!dateFrom || !dateTo || typeof dateFrom !== "string" || typeof dateTo !== "string") {
      return NextResponse.json(
        { error: "dateFrom and dateTo (YYYY-MM-DD) are required" },
        { status: 400 },
      );
    }

    const rangeCheck = validateAnalysisDateRange(dateFrom, dateTo);
    if (!rangeCheck.ok) {
      return NextResponse.json({ error: rangeCheck.error }, { status: 400 });
    }

    const since = startOfDayUtcIso(dateFrom);
    const until = endOfDayUtcIso(dateTo);

    console.log(`[API] analyze-impact: ${repos.length} repos, window ${dateFrom}…${dateTo}`);

    const githubService = new GitHubService(token, { since, until });
    const connection = await githubService.validateConnection();
    if (!connection.valid) {
      return NextResponse.json({ error: "Invalid GitHub token" }, { status: 401 });
    }

    const data = await githubService.fetchAllRepos(repos);

    const fromBody = body.openrouterApiKey?.trim();
    const openrouterKey = fromBody || getOpenRouterApiKey();
    const engine = new ScoringEngine(openrouterKey);

    console.log(`[API] OpenRouter key loaded: ${!!openrouterKey} (len=${openrouterKey?.length ?? 0})`);
    const result = await engine.analyzeMultiRepo(data);

    return NextResponse.json({
      success: true,
      ...result,
      analysisWindow: { from: dateFrom, to: dateTo },
    });
  } catch (err) {
    console.error("[API] analyze-impact error:", err);
    return NextResponse.json(
      { error: "Analysis failed", details: String(err) },
      { status: 500 },
    );
  }
}
