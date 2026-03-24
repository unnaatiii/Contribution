"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Activity,
  Loader2,
  RefreshCw,
  GitBranch,
  Clock,
  Users,
  GitCommit,
  AlertCircle,
  FolderGit2,
} from "lucide-react";
import type { AnalysisResult, RepoConfig } from "@/lib/types";
import Leaderboard from "./Leaderboard";
import ContributionCharts from "./ContributionCharts";
import ContributorCard from "./ContributorCard";
import TeamInsights from "./TeamInsights";
import ConnectForm from "./ConnectForm";
import CommitAnalysisTable from "./CommitAnalysisTable";
import InsightSummaryCards from "./InsightSummaryCards";
import type { ConnectAnalysisConfig } from "./ConnectForm";
import { defaultAnalysisDateRange } from "@/lib/date-range";

type Phase = "connect" | "analyzing" | "done" | "error";

const SESSION_RESULT_KEY = "devimpact-result";
const SESSION_CONFIG_KEY = "devimpact-config";

function normalizeStoredConfig(raw: unknown): ConnectAnalysisConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.token !== "string" || !Array.isArray(o.repos)) return null;
  const fallback = defaultAnalysisDateRange();
  const dateFrom = typeof o.dateFrom === "string" ? o.dateFrom : fallback.dateFrom;
  const dateTo = typeof o.dateTo === "string" ? o.dateTo : fallback.dateTo;
  return {
    token: o.token,
    repos: o.repos as ConnectAnalysisConfig["repos"],
    dateFrom,
    dateTo,
  };
}

export default function Dashboard() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [phase, setPhase] = useState<Phase>("connect");
  const [config, setConfig] = useState<ConnectAnalysisConfig | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [selectedDev, setSelectedDev] = useState<string | null>(null);
  const [hoveredProfile, setHoveredProfile] = useState<string | null>(null);
  const [progress, setProgress] = useState("");

  useEffect(() => {
    try {
      const resRaw = sessionStorage.getItem(SESSION_RESULT_KEY);
      if (resRaw) {
        const data = JSON.parse(resRaw) as AnalysisResult & { success?: boolean };
        if (Array.isArray(data.developers)) {
          setResult(data);
          setPhase("done");
          const cfgRaw = sessionStorage.getItem(SESSION_CONFIG_KEY);
          if (cfgRaw) {
            const parsed = normalizeStoredConfig(JSON.parse(cfgRaw));
            if (parsed) setConfig(parsed);
          }
          if (data.developers.length > 0) {
            setSelectedDev((prev) => prev ?? data.developers[0].login);
          }
        }
      }
    } catch {
      /* ignore corrupt session */
    } finally {
      setBootstrapped(true);
    }
  }, []);

  const clearSessionAndGoConnect = useCallback(() => {
    try {
      sessionStorage.removeItem(SESSION_RESULT_KEY);
      sessionStorage.removeItem(SESSION_CONFIG_KEY);
    } catch {
      /* ignore */
    }
    setResult(null);
    setConfig(null);
    setPhase("connect");
    setError("");
  }, []);

  const runAnalysis = useCallback(async (cfg: ConnectAnalysisConfig) => {
    setConfig(cfg);
    setPhase("analyzing");
    setProgress(`Fetching data from ${cfg.repos.length} repos and running AI analysis...`);
    setError("");

    try {
      const res = await fetch("/api/analyze-impact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      setResult(data);
      setPhase("done");
      try {
        sessionStorage.setItem(SESSION_RESULT_KEY, JSON.stringify(data));
        sessionStorage.setItem(SESSION_CONFIG_KEY, JSON.stringify(cfg));
      } catch {
        /* quota exceeded — ignore */
      }
      if (data.developers?.length > 0) {
        setSelectedDev(data.developers[0].login);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      setPhase("error");
    }
  }, []);

  const handleRefresh = () => {
    if (config) runAnalysis(config);
  };

  if (!bootstrapped) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-accent animate-spin" />
      </div>
    );
  }

  if (phase === "connect") {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--background)]">
        <header className="border-b border-[var(--cursor-border-subtle)] px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <div className="p-2 bg-accent/15 rounded-lg ring-1 ring-accent/25">
              <Activity className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">DevImpact AI</h1>
              <p className="text-xs text-zinc-500">Multi-Repo Developer Impact Analysis</p>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-2xl">
            <div className="text-center mb-10">
              <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
                Measure Real Impact
              </h1>
              <p className="text-zinc-400 text-lg max-w-lg mx-auto">
                Connect with your GitHub PAT, pick which repos to analyze, then
                get AI impact scoring across commits and teams.
              </p>
            </div>
            <ConnectForm onConnected={runAnalysis} />

            <div className="mt-8 grid grid-cols-4 gap-3 max-w-2xl mx-auto stagger-animate">
              {[
                { label: "Multi-Repo", desc: "Cross-project" },
                { label: "Deep AI", desc: "Diff analysis" },
                { label: "Impact ROI", desc: "Business value" },
                { label: "Team Intel", desc: "Dev vs Manager" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="text-center p-3 rounded-xl border border-[var(--cursor-border-subtle)] bg-[var(--cursor-panel)] animate-fade-rise transition-shadow duration-300 hover:shadow-[0_0_20px_-6px_rgba(5,79,153,0.2)]"
                >
                  <p className="text-sm font-medium text-zinc-300">{item.label}</p>
                  <p className="text-xs text-zinc-600 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (phase === "analyzing") {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center max-w-md animate-fade-rise">
          <Loader2 className="w-12 h-12 text-accent animate-spin mx-auto mb-6" />
          <h2 className="text-xl font-semibold text-white mb-2">
            AI Analysis in Progress
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed">{progress}</p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-accent animate-pulse"
                  style={{ animationDelay: `${i * 200}ms` }}
                />
              ))}
            </div>
            <span className="text-xs text-zinc-600">
              Fetching diffs & analyzing with AI...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Analysis Failed</h2>
          <p className="text-sm text-red-400/80 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={clearSessionAndGoConnect}
              className="px-5 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl text-sm hover:bg-white/10 transition-colors cursor-pointer"
            >
              Back to Setup
            </button>
            {config && (
              <button
                onClick={handleRefresh}
                className="px-5 py-2.5 bg-accent text-white rounded-xl text-sm hover:bg-accent-hover transition-colors cursor-pointer"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-50 border-b border-[var(--cursor-border-subtle)] bg-[var(--background)]/85 backdrop-blur-xl px-6 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/15 rounded-lg ring-1 ring-accent/25">
              <Activity className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-white">DevImpact AI</h1>
              <div className="flex flex-col gap-0.5 text-xs text-zinc-500">
                <span className="flex items-center gap-2">
                  <FolderGit2 className="w-3 h-3 shrink-0" />
                  <span className="truncate">{result.repos.map((r) => r.label).join(", ")}</span>
                </span>
                {result.analysisWindow && (
                  <span className="pl-5 text-[10px] text-zinc-600">
                    Data: {result.analysisWindow.from} → {result.analysisWindow.to}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5" />
                {result.repoCount} repos
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                {result.developers.length} devs
              </span>
              <span className="flex items-center gap-1.5">
                <GitCommit className="w-3.5 h-3.5" />
                {result.commitCount} commits
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent ring-1 ring-accent/25">
                {result.aiPowered
                  ? `AI (${result.modelsUsed.length} models)`
                  : "Heuristic"}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {new Date(result.analyzedAt).toLocaleDateString()}
              </span>
            </div>
            <button
              onClick={handleRefresh}
              className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              title="Re-run analysis"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={clearSessionAndGoConnect}
              className="text-xs px-3 py-1.5 text-zinc-400 hover:text-white border border-white/10 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              Change Repos
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-8">
        <InsightSummaryCards result={result} />

        <details className="mb-6 rounded-xl border border-[var(--cursor-border-subtle)] bg-[var(--cursor-panel)] px-4 py-3 text-sm open:pb-4 group transition-colors hover:border-[var(--cursor-border)]">
          <summary className="cursor-pointer text-[#c9d1d9] font-medium list-none flex items-center gap-2 [&::-webkit-details-marker]:hidden">
            <span className="text-accent transition-transform group-open:rotate-90 inline-block">▸</span>
            How impact scores work (commits vs leaderboard)
          </summary>
          <div className="mt-3 text-[#8b949e] leading-relaxed space-y-2 pl-6 border-l border-[var(--cursor-border-subtle)]">
            <p>
              <span className="text-zinc-300">Per-commit AI score (e.g. 60/100):</span> the model explains{" "}
              <strong className="text-zinc-200">why</strong> that number in{" "}
              <em>Why this score</em>, lists <em>parameters considered</em>, and maps{" "}
              <em>modules &amp; flows</em> affected. Expand any row in the AI Commit Analysis table to read
              the full breakdown.
            </p>
            <p>
              <span className="text-zinc-300">Leaderboard total impact:</span> not commit count. Each
              scored commit adds{" "}
              <code className="text-xs bg-black/30 px-1 rounded">
                typeWeight × impactMultiplier × repoWeight + 0.3 × businessScore
              </code>
              . A frontend developer with fewer commits can still lead if those commits carry high
              business scores, cross cutting user flows, or span multiple repos (higher aggregate weight).
            </p>
          </div>
        </details>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <div className="xl:col-span-4 space-y-8">
            <Leaderboard entries={result.leaderboard} />
            <TeamInsights
              insights={result.teamInsights}
              topContributor={result.topContributor}
            />
          </div>

          <div className="xl:col-span-8 space-y-8">
            <ContributionCharts result={result} selectedDeveloper={selectedDev} />

            <CommitAnalysisTable
              analyzedCommits={result.analyzedCommits}
              modelsUsed={result.modelsUsed}
              aiPowered={result.aiPowered}
              aiDiagnostics={result.aiDiagnostics}
            />

            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Contributor Profiles</h2>
              <p className="text-xs text-zinc-500 mb-3">
                Hover a card to focus it; others blur. Click to open full timeline and AI analysis.
              </p>
              <div
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
                onMouseLeave={() => setHoveredProfile(null)}
              >
                {result.developers.map((dev) => (
                  <ContributorCard
                    key={dev.login}
                    developer={dev}
                    isSelected={selectedDev === dev.login}
                    hoveredLogin={hoveredProfile}
                    onHoverLogin={setHoveredProfile}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
