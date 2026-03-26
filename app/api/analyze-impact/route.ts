import { NextResponse } from "next/server";
import { GitHubService } from "@/lib/github-service";
import { ScoringEngine } from "@/lib/scoring-engine";
import { getOpenRouterApiKey } from "@/lib/openrouter-key";
import {
  endOfDayUtcIso,
  startOfDayUtcIso,
  validateAnalysisDateRange,
} from "@/lib/date-range";
import { cloneAnalysisCache, mergeAnalysisCachePreferDatabase } from "@/lib/analysis-cache";
import type { AnalyzeImpactPayload } from "@/lib/types";
import { tryDeriveUserIdFromToken } from "@/lib/user-id";
import {
  buildAllowlistSet,
  commitMatchesAllowlist,
  loginMatchesAllowlist,
} from "@/lib/contributor-allowlist";
import {
  saveReposFromConfigs,
  touchReposLastSynced,
  upsertCommitsFromGitHub,
} from "@/lib/db";
import { isAnalysisDatabaseReady } from "@/services/database/registry";
import { getAIAnalysisForRepos, persistAiAnalysisAfterRun } from "@/services/analysisService";
import { saveAnalysisRun } from "@/services/runService";

export const runtime = "nodejs";
export const maxDuration = 180;

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

    const commitLimit = Math.min(
      500,
      Math.max(5, Number(body.commitLimitPerRepo) || 200),
    );

    const data = await githubService.fetchAllRepos(repos, {
      maxCommits: commitLimit,
      skipDetails: false,
    });

    const allow = buildAllowlistSet(body.allowedLogins);
    if (allow) {
      const beforeCommits = data.commits.length;
      data.commits = data.commits.filter((c) => commitMatchesAllowlist(c, allow));
      data.reviews = data.reviews.filter((r) => loginMatchesAllowlist(r.reviewer, allow));
      data.pullRequests = data.pullRequests.filter((p) => loginMatchesAllowlist(p.author, allow));
      const realLeft = data.commits.filter((c) => !c.isMergeCommit).length;
      console.log(
        `[API] allowlist ${allow.size} logins: commits ${beforeCommits} → ${data.commits.length} (${realLeft} non-merge)`,
      );
      if (realLeft === 0) {
        return NextResponse.json(
          {
            error:
              "allowedLogins removed all non-merge commits. Include logins that authored commits in this window, widen the list or dates, or omit allowedLogins.",
          },
          { status: 400 },
        );
      }
    }

    const repoKeys = repos.map((r) => `${r.owner}/${r.repo}`);
    let userId: string | null = null;
    if (isAnalysisDatabaseReady()) {
      userId = tryDeriveUserIdFromToken(token);
      if (userId) {
        try {
          await saveReposFromConfigs(userId, repos);
          await upsertCommitsFromGitHub(userId, data.commits);
          await touchReposLastSynced(userId, repoKeys);
        } catch {
          /* non-fatal */
        }
      }
    }

    const fromBody = body.openrouterApiKey?.trim();
    const openrouterKey = fromBody || getOpenRouterApiKey();
    const engine = new ScoringEngine(openrouterKey);

    let mergedCache = cloneAnalysisCache(body.analysisCache ?? null);
    if (userId) {
      try {
        const dbCache = await getAIAnalysisForRepos(userId, repos);
        mergedCache = mergeAnalysisCachePreferDatabase(dbCache, mergedCache);
      } catch {
        /* non-fatal */
      }
    }

    console.log(`[API] OpenRouter key loaded: ${!!openrouterKey} (len=${openrouterKey?.length ?? 0})`);
    const { result, analysisCache } = await engine.composeFromMultiRepo(data, {
      analysisCache: mergedCache,
      skipAi: false,
      analysisDbUserId: userId,
    });

    let analysisRunId: string | undefined;
    const databasePersistence = Boolean(userId);
    if (userId) {
      try {
        await persistAiAnalysisAfterRun(userId, result);
      } catch {
        /* non-fatal */
      }
      try {
        const id = await saveAnalysisRun(userId, {
          repoLabels: repos.map((r) => r.label),
          from: dateFrom,
          to: dateTo,
          result,
        });
        if (id) analysisRunId = id;
      } catch {
        /* non-fatal */
      }
    }

    return NextResponse.json({
      success: true,
      ...result,
      analysisCache,
      analysisWindow: { from: dateFrom, to: dateTo },
      analysisAllowlist: body.allowedLogins?.length ? body.allowedLogins : undefined,
      databasePersistence,
      ...(analysisRunId ? { analysisRunId } : {}),
    });
  } catch (err) {
    console.error("[API] analyze-impact error:", err);
    return NextResponse.json(
      { error: "Analysis failed", details: String(err) },
      { status: 500 },
    );
  }
}
