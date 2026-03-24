import type {
  CommitData,
  AICommitAnalysis,
  AnalyzedCommit,
  ContributionType,
  ImpactLevel,
} from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Free / :free models first so analysis works with $0 OpenRouter credits.
 * Paid models follow for accounts with balance (402 skipped → next model).
 * `mistralai/` prefix required — bare `mistral-small-...` is not a valid OpenRouter ID.
 */
const MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "qwen/qwen3-4b:free",
  "openrouter/free",
  "google/gemini-2.0-flash-001",
  "deepseek/deepseek-chat",
] as const;

function analysisModelOrder(): string[] {
  const primary = process.env.OPENROUTER_ANALYSIS_MODEL?.trim();
  if (primary) {
    const rest = [...MODELS].filter((m) => m !== primary);
    return [primary, ...rest];
  }
  return [...MODELS];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Some providers reject `seed`; omit for :free and aggregate routers. */
function modelSupportsSeed(model: string): boolean {
  if (model.includes(":free") || model === "openrouter/free") return false;
  return true;
}

/** Same commit → same seed so providers that honor `seed` return stable scores. */
function deterministicSeedFromSha(sha: string): number {
  let h = 2166136261;
  for (let i = 0; i < sha.length; i++) {
    h ^= sha.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 42;
}

export type AIBatchDiagnostics = {
  openrouterConfigured: boolean;
  commitsEligible: number;
  commitsWithAnalysis: number;
  modelCallFailures: number;
  /** Last few distinct error snippets (HTTP body / parse errors) */
  recentErrors: string[];
};

const SYSTEM_PROMPT = `You are a staff+ engineer performing a rigorous, evidence-based review of exactly ONE Git commit.

INPUTS (order of trust): (1) unified diff, (2) file paths/extensions, (3) full commit message, (4) line stats (weak).

You MUST produce explicit audit-style output so humans understand WHY a score was chosen.

TYPE RULES (strict): feature | bug_fix | refactor | test | chore — same definitions as before: user-visible behavior vs fix vs internal vs tests-only vs noise.

IMPACT_LEVEL vs business_impact_score (1–100), aligned:
- critical 85–100, high 70–84, medium 40–69, low 1–39 (security/data/payments can be high despite small diff).

REQUIRED JSON FIELDS (all mandatory, use arrays of short strings):
- type, impact_level, business_impact_score
- reasoning: 2–4 sentences — what changed, key evidence from paths/diff
- parameters_considered: 4–8 bullets you actually weighed (e.g. "correctness of payload to backend", "user-visible form submit path", "type contract FE/BE", "regression risk", "repo role frontend/backend/erp")
- score_justification: 3–6 sentences that EXPLICITLY tie the numeric business_impact_score to those parameters (e.g. "Score 60 because … not 80 because …"). Mention tradeoffs.
- affected_modules_and_flows: 3–10 items naming concrete modules, routes, APIs, screens, jobs, or user journeys touched or downstream (infer from paths if needed)

If diff is missing: state uncertainty in score_justification; cap score at 72 unless message implies outage/security/data loss.

Determinism: Same evidence should yield the same type, impact_level, and business_impact_score band. Do not randomize. The AUTHOR line may be an unlinked local git name — judge only the code/message; never use author identity to raise or lower the score.

OUTPUT: ONE raw JSON object only — no markdown fences, no extra keys:
{"type":"...","impact_level":"...","business_impact_score":<int>,"reasoning":"...","parameters_considered":["..."],"score_justification":"...","affected_modules_and_flows":["..."]}`;

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1].trim() : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return body.slice(start, end + 1);
}

/** Keep score bands aligned with impact_level so dashboards stay interpretable. */
function alignScoreToImpact(score: number, level: ImpactLevel): number {
  const bands: Record<ImpactLevel, [number, number]> = {
    critical: [85, 100],
    high: [70, 84],
    medium: [40, 69],
    low: [1, 39],
  };
  const [min, max] = bands[level];
  return Math.min(max, Math.max(min, Math.round(score)));
}

function asStringArray(v: unknown, max = 14): string[] {
  if (Array.isArray(v)) {
    return v.map((x) => String(x).trim()).filter(Boolean).slice(0, max);
  }
  if (typeof v === "string" && v.trim()) {
    return v
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, max);
  }
  return [];
}

export class AIAnalyzer {
  private apiKey: string | null;
  lastBatchDiagnostics: AIBatchDiagnostics;

  constructor(apiKey?: string) {
    this.apiKey = apiKey?.trim() || null;
    this.lastBatchDiagnostics = {
      openrouterConfigured: false,
      commitsEligible: 0,
      commitsWithAnalysis: 0,
      modelCallFailures: 0,
      recentErrors: [],
    };
  }

  get isAIPowered(): boolean {
    return this.apiKey !== null;
  }

  get modelNames(): string[] {
    return [...MODELS];
  }

  private pushError(msg: string) {
    const short = msg.replace(/\s+/g, " ").slice(0, 180);
    if (!this.lastBatchDiagnostics.recentErrors.includes(short)) {
      this.lastBatchDiagnostics.recentErrors.push(short);
    }
    if (this.lastBatchDiagnostics.recentErrors.length > 8) {
      this.lastBatchDiagnostics.recentErrors.shift();
    }
  }

  async analyzeAllCommits(commits: CommitData[]): Promise<AnalyzedCommit[]> {
    const realCommits = commits.filter((c) => !c.isMergeCommit);
    const mergeCommits = commits.filter((c) => c.isMergeCommit);

    this.lastBatchDiagnostics = {
      openrouterConfigured: !!this.apiKey,
      commitsEligible: realCommits.length,
      commitsWithAnalysis: 0,
      modelCallFailures: 0,
      recentErrors: [],
    };

    console.log(
      `[AI] Analyzing ${realCommits.length} real commits, skipping ${mergeCommits.length} merge commits (key: ${this.apiKey ? "yes" : "no"})`,
    );

    const analyzed: AnalyzedCommit[] = [];

    const pacingMs = Math.max(
      0,
      Number.parseInt(process.env.OPENROUTER_COMMIT_DELAY_MS ?? "180", 10) || 0,
    );

    for (let i = 0; i < realCommits.length; i++) {
      const commit = realCommits[i];
      if (!this.apiKey) {
        analyzed.push(this.toAnalyzedCommit(commit, null, "none"));
        continue;
      }

      let analysis: AICommitAnalysis | null = null;
      let modelUsed = "none";

      for (const model of analysisModelOrder()) {
        const result = await this.callModel(model, commit);
        if (result) {
          analysis = result;
          modelUsed = model;
          break;
        }
      }

      if (analysis) {
        this.lastBatchDiagnostics.commitsWithAnalysis += 1;
      }

      analyzed.push(this.toAnalyzedCommit(commit, analysis, modelUsed));

      if (pacingMs > 0 && i < realCommits.length - 1) {
        await sleep(pacingMs);
      }
    }

    for (const mc of mergeCommits) {
      analyzed.push(this.toAnalyzedCommit(mc, null, "skipped"));
    }

    console.log(
      `[AI] Done: ${this.lastBatchDiagnostics.commitsWithAnalysis}/${this.lastBatchDiagnostics.commitsEligible} with analysis; ${this.lastBatchDiagnostics.modelCallFailures} failed model calls`,
    );
    return analyzed;
  }

  private async callModel(
    model: string,
    commit: CommitData,
  ): Promise<AICommitAnalysis | null> {
    const repoContext: Record<string, string> = {
      frontend:
        "Repo role: CUSTOMER-FACING FRONTEND. Weight UX, accessibility, performance perceived by users, and broken flows.",
      backend:
        "Repo role: BACKEND / APIs / services. Weight correctness, security, data integrity, scalability, and blast radius.",
      erp: "Repo role: ERP / ADMIN / internal ops. Weight operational risk, reporting accuracy, permissions, and business process breakage.",
    };

    const diffSection = commit.diff
      ? `\n\nCODE DIFF (truncated):\n${commit.diff.substring(0, 4500)}`
      : "\n\nCODE DIFF: (not available — infer carefully from message and file paths only; widen uncertainty, avoid extreme scores unless message clearly implies critical risk.)";

    const paths =
      commit.filesChanged.length > 0
        ? commit.filesChanged.slice(0, 40).join("\n")
        : "(unknown — list not fetched)";

    const userPrompt = `Repository label: "${commit.repoLabel}" (${commit.repoType})
${repoContext[commit.repoType] ?? repoContext.backend}

COMMIT (first line): ${commit.message.split("\n")[0].slice(0, 240)}
FULL MESSAGE (may be multi-line, truncated):
${commit.message.slice(0, 1200)}

AUTHOR: ${commit.author}
GITHUB REPO: ${commit.repo}
LINE STATS: +${commit.additions} / -${commit.deletions}

FILES TOUCHED (paths):
${paths}
${diffSection}

Return the JSON object now.`;

    try {
      console.log(`[AI] ${model} → ${commit.sha.slice(0, 7)} (${commit.repoLabel})`);

      const baseBody: Record<string, unknown> = {
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
        max_tokens: 1400,
      };
      if (modelSupportsSeed(model)) {
        baseBody.seed = deterministicSeedFromSha(commit.sha);
      }

      const doFetch = () =>
        fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER || "https://localhost:3000",
            "X-Title": "DevImpact AI",
          },
          body: JSON.stringify(baseBody),
        });

      let res = await doFetch();

      if (res.status === 429) {
        const retryAfter = 2200;
        console.log(`[AI] ${model} HTTP 429 — retry once after ${retryAfter}ms`);
        await sleep(retryAfter);
        res = await doFetch();
      }

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        this.lastBatchDiagnostics.modelCallFailures += 1;
        this.pushError(`${model} HTTP ${res.status}: ${errBody.slice(0, 120)}`);
        console.log(`[AI] ${model} HTTP ${res.status}: ${errBody.slice(0, 200)}`);
        return null;
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content ?? "";
      const jsonStr = extractJsonObject(content);
      if (!jsonStr) {
        this.lastBatchDiagnostics.modelCallFailures += 1;
        this.pushError(`${model}: no JSON in model output`);
        console.log(`[AI] ${model} parse: no JSON, raw=${content.slice(0, 120)}...`);
        return null;
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(jsonStr) as Record<string, unknown>;
      } catch {
        this.lastBatchDiagnostics.modelCallFailures += 1;
        this.pushError(`${model}: JSON.parse failed`);
        return null;
      }

      const validTypes: ContributionType[] = ["feature", "bug_fix", "refactor", "test", "chore"];
      const validImpacts: ImpactLevel[] = ["low", "medium", "high", "critical"];

      const rawType = String(parsed.type ?? "").replace(/\s/g, "_").toLowerCase();
      const normalizedType = rawType === "bugfix" ? "bug_fix" : rawType;
      const type = validTypes.includes(normalizedType as ContributionType)
        ? (normalizedType as ContributionType)
        : "chore";

      const il = String(parsed.impact_level ?? "medium").toLowerCase();
      const impact_level = validImpacts.includes(il as ImpactLevel) ? (il as ImpactLevel) : "medium";

      const scoreRaw = Number(parsed.business_impact_score);
      const rawScore = Number.isFinite(scoreRaw)
        ? Math.min(100, Math.max(1, Math.round(scoreRaw)))
        : 35;
      const alignedScore = alignScoreToImpact(rawScore, impact_level);

      const reasoning = String(parsed.reasoning ?? "").trim().slice(0, 900);
      const scoreJust = String(
        parsed.score_justification ?? parsed.score_rationale ?? reasoning,
      )
        .trim()
        .slice(0, 1400);
      const params = asStringArray(parsed.parameters_considered);
      const flows = asStringArray(parsed.affected_modules_and_flows);

      const result: AICommitAnalysis = {
        type,
        impact_level,
        business_impact_score: alignedScore,
        reasoning: reasoning || scoreJust.slice(0, 400),
        parameters_considered:
          params.length > 0
            ? params
            : ["change type & intent", "evidence from message/paths", "user/system blast radius"],
        score_justification:
          scoreJust ||
          `${alignedScore}/100 aligns with ${impact_level} impact for a ${type} change; see reasoning.`,
        affected_modules_and_flows:
          flows.length > 0
            ? flows
            : commit.filesChanged.length > 0
              ? commit.filesChanged.slice(0, 6).map((f) => `Touched: ${f}`)
              : ["Unable to infer modules — no paths in payload"],
      };

      console.log(
        `[AI] ${model} OK ${commit.sha.slice(0, 7)}: ${result.type}/${result.impact_level} (${alignedScore})`,
      );
      return result;
    } catch (err) {
      this.lastBatchDiagnostics.modelCallFailures += 1;
      this.pushError(`${model}: ${err instanceof Error ? err.message : "unknown"}`);
      console.log(`[AI] ${model} error: ${err instanceof Error ? err.message : "unknown"}`);
      return null;
    }
  }

  private toAnalyzedCommit(
    commit: CommitData,
    analysis: AICommitAnalysis | null,
    modelUsed: string,
  ): AnalyzedCommit {
    return {
      sha: commit.sha,
      message: commit.message,
      author: commit.author,
      authorEmail: commit.authorEmail,
      date: commit.date,
      repo: commit.repo,
      repoLabel: commit.repoLabel,
      repoType: commit.repoType,
      filesChanged: commit.filesChanged,
      isMergeCommit: commit.isMergeCommit,
      analysis,
      modelUsed,
    };
  }
}
