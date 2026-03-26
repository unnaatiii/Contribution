import { NextResponse } from "next/server";
import { GitHubService } from "@/lib/github-service";
import { ScoringEngine } from "@/lib/scoring-engine";
import { getOpenRouterApiKey } from "@/lib/openrouter-key";
import {
  endOfDayUtcIso,
  startOfDayUtcIso,
  validateWideDashboardDateRange,
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
  filterCommitsForWideWindow,
  getCommitsForReposWindow,
  getRepoLastSyncedAtMap,
  mapDbCommitsToCommitData,
  saveReposFromConfigs,
  touchReposLastSynced,
  upsertCommitsFromGitHub,
} from "@/lib/db";
import { isAnalysisDatabaseReady } from "@/services/database/registry";
import { getAIAnalysisForRepos } from "@/services/analysisService";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Fast GitHub-only fetch + optional merge of cached AI (no OpenRouter calls). */
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

    const rangeCheck = validateWideDashboardDateRange(dateFrom, dateTo);
    if (!rangeCheck.ok) {
      return NextResponse.json({ error: rangeCheck.error }, { status: 400 });
    }

    const since = startOfDayUtcIso(dateFrom);
    const until = endOfDayUtcIso(dateTo);
    const commitLimit = Math.min(
      10_000,
      Math.max(10, Number(body.commitLimitPerRepo) || 2500),
    );

    console.log(`[API] load-base: ${repos.length} repos, limit ${commitLimit}/repo`);

    const githubService = new GitHubService(token, { since, until });
    const connection = await githubService.validateConnection();
    if (!connection.valid) {
      return NextResponse.json({ error: "Invalid GitHub token" }, { status: 401 });
    }

    const ghData = await githubService.fetchAllRepos(repos, {
      maxCommits: commitLimit,
      skipDetails: true,
    });

    const allow = buildAllowlistSet(body.allowedLogins);
    if (allow) {
      const beforeCommits = ghData.commits.length;
      ghData.commits = ghData.commits.filter((c) => commitMatchesAllowlist(c, allow));
      ghData.reviews = ghData.reviews.filter((r) => loginMatchesAllowlist(r.reviewer, allow));
      ghData.pullRequests = ghData.pullRequests.filter((p) => loginMatchesAllowlist(p.author, allow));
      const realLeft = ghData.commits.filter((c) => !c.isMergeCommit).length;
      console.log(
        `[API] load-base allowlist: commits ${beforeCommits} → ${ghData.commits.length} (${realLeft} non-merge)`,
      );
      if (realLeft === 0) {
        return NextResponse.json(
          {
            error:
              "allowedLogins removed all non-merge commits. Widen the login list or date range, or omit allowedLogins.",
          },
          { status: 400 },
        );
      }
    }

    const sinceTs = new Date(since).getTime();
    const untilTs = new Date(until).getTime();
    const repoKeys = repos.map((r) => `${r.owner}/${r.repo}`);
    const repoByKey = new Map<string, (typeof repos)[number]>();
    for (const r of repos) {
      repoByKey.set(`${r.owner}/${r.repo}`, r);
    }

    let userId: string | null = null;
    let repoSyncAt: Record<string, string> = {};
    let commitsDataSource: "github" | "database" = "github";
    let data = ghData;

    if (isAnalysisDatabaseReady()) {
      userId = tryDeriveUserIdFromToken(token);
      if (userId) {
        try {
          await saveReposFromConfigs(userId, repos);
          await upsertCommitsFromGitHub(userId, ghData.commits);
          await touchReposLastSynced(userId, repoKeys);
          repoSyncAt = await getRepoLastSyncedAtMap(userId, repoKeys);
        } catch {
          /* non-fatal */
        }

        try {
          const dbRows = await getCommitsForReposWindow(userId, repoKeys, since, until, commitLimit);
          let mapped = mapDbCommitsToCommitData(dbRows, repoByKey);
          mapped = filterCommitsForWideWindow(mapped, sinceTs, untilTs);
          if (allow) {
            mapped = mapped.filter((c) => commitMatchesAllowlist(c, allow));
          }
          const realLeftDb = mapped.filter((c) => !c.isMergeCommit).length;
          if (mapped.length > 0 && realLeftDb > 0) {
            data = {
              ...ghData,
              commits: mapped,
              fetchedAt: new Date().toISOString(),
            };
            commitsDataSource = "database";
            console.log(`[API] load-base: using ${mapped.length} commits from database`);
          }
        } catch {
          /* non-fatal */
        }
      }
    }

    const fromBody = body.openrouterApiKey?.trim();
    const openrouterKey = fromBody || getOpenRouterApiKey();
    const engine = new ScoringEngine(openrouterKey);

    let mergedCache = cloneAnalysisCache(body.analysisCache ?? null);
    const databasePersistence = Boolean(userId);
    if (userId) {
      try {
        const dbCache = await getAIAnalysisForRepos(userId, repos);
        mergedCache = mergeAnalysisCachePreferDatabase(dbCache, mergedCache);
      } catch {
        /* non-fatal */
      }
    }

    const { result, analysisCache } = await engine.composeFromMultiRepo(data, {
      analysisCache: mergedCache,
      skipAi: true,
    });

    return NextResponse.json({
      success: true,
      ...result,
      analysisCache,
      analysisWindow: { from: dateFrom, to: dateTo },
      analysisAllowlist: body.allowedLogins?.length ? body.allowedLogins : undefined,
      databasePersistence,
      repoSyncAt,
      commitsDataSource,
    });
  } catch (err) {
    console.error("[API] load-base error:", err);
    return NextResponse.json(
      { error: "Failed to load GitHub data", details: String(err) },
      { status: 500 },
    );
  }
}
