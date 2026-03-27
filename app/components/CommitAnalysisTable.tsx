"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Brain, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import type {
  AnalyzedCommit,
  AIAnalysisDiagnostics,
  ContributionType,
} from "@/lib/types";
import { formatCommitDateTime } from "@/lib/format-commit-date";
import { analyzedCommitRowKey, dedupeAnalyzedCommitsByRepoSha } from "@/lib/dedupe-analyzed-commits";
import CommitsTimelineChart from "@/app/components/CommitsTimelineChart";

interface CommitAnalysisTableProps {
  analyzedCommits: AnalyzedCommit[];
  modelsUsed: string[];
  aiPowered?: boolean;
  aiDiagnostics?: AIAnalysisDiagnostics;
  /** Full or short SHA from `/commits?sha=` — expands row and scrolls into view */
  highlightSha?: string | null;
}

const impactColors: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10",
  high: "text-amber-400 bg-amber-500/10",
  medium: "text-purple-200 bg-purple-500/15",
  low: "text-gray-400 bg-slate-500/10",
};

const typeColors: Record<string, string> = {
  feature: "text-purple-300",
  bug_fix: "text-red-400",
  refactor: "text-emerald-400",
  test: "text-purple-400",
  chore: "text-zinc-400",
};

function shaMatchesQuery(commitSha: string, query: string): boolean {
  const t = query.trim().toLowerCase();
  if (!t) return false;
  const c = commitSha.toLowerCase();
  return c === t || c.startsWith(t);
}

function commitRowKey(c: AnalyzedCommit): string {
  return analyzedCommitRowKey(c);
}

function commitRowDomId(c: AnalyzedCommit): string {
  return `commit-row-${c.repo.replace(/\//g, "__")}--${c.sha}`;
}

const CONTRIBUTION_TYPES: ContributionType[] = [
  "feature",
  "bug_fix",
  "refactor",
  "test",
  "chore",
];

const SORT_OPTIONS = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
  { value: "impact_desc", label: "Impact (high → low)" },
  { value: "impact_asc", label: "Impact (low → high)" },
  { value: "type_asc", label: "Type A–Z" },
] as const;

type SortMode = (typeof SORT_OPTIONS)[number]["value"];

function isContributionType(s: string): s is ContributionType {
  return (CONTRIBUTION_TYPES as readonly string[]).includes(s);
}

function commitDayKeyLocal(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sortCommits(rows: AnalyzedCommit[], mode: SortMode): AnalyzedCommit[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    const ta = new Date(a.date).getTime();
    const tb = new Date(b.date).getTime();
    switch (mode) {
      case "date_desc":
        return tb - ta;
      case "date_asc":
        return ta - tb;
      case "impact_desc": {
        const sa = a.analysis?.business_impact_score;
        const sb = b.analysis?.business_impact_score;
        if (sa == null && sb == null) return tb - ta;
        if (sa == null) return 1;
        if (sb == null) return -1;
        return sb - sa;
      }
      case "impact_asc": {
        const sa = a.analysis?.business_impact_score;
        const sb = b.analysis?.business_impact_score;
        if (sa == null && sb == null) return tb - ta;
        if (sa == null) return 1;
        if (sb == null) return -1;
        return sa - sb;
      }
      case "type_asc": {
        const xa = a.analysis?.type ?? "";
        const xb = b.analysis?.type ?? "";
        const c = xa.localeCompare(xb);
        if (c !== 0) return c;
        return tb - ta;
      }
      default:
        return tb - ta;
    }
  });
  return copy;
}

export default function CommitAnalysisTable({
  analyzedCommits,
  modelsUsed,
  aiPowered,
  aiDiagnostics,
  highlightSha,
}: CommitAnalysisTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);

  const setQuery = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === undefined || v === null || v === "") p.delete(k);
        else p.set(k, v);
      }
      const q = p.toString();
      router.push(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const typeFilterRaw = searchParams.get("type")?.trim() ?? "";
  const typeFilter: ContributionType | null =
    typeFilterRaw && isContributionType(typeFilterRaw) ? typeFilterRaw : null;

  const dayFilter = searchParams.get("day")?.trim() ?? null;

  const sortRaw = searchParams.get("sort")?.trim() ?? "";
  const sortMode: SortMode =
    sortRaw === "date_asc" ||
    sortRaw === "impact_desc" ||
    sortRaw === "impact_asc" ||
    sortRaw === "type_asc" ?
      sortRaw
    : "date_desc";

  const [commitListFilter, setCommitListFilter] = useState<"all" | "analyzed">("all");

  const baseCommits = useMemo(() => {
    const filtered = analyzedCommits.filter((c) => !c.isMergeCommit);
    return dedupeAnalyzedCommitsByRepoSha(filtered);
  }, [analyzedCommits]);

  const afterListFilter = useMemo(() => {
    if (commitListFilter === "analyzed") {
      return baseCommits.filter((c) => c.analysis);
    }
    return baseCommits;
  }, [baseCommits, commitListFilter]);

  const commitsForTimeline = useMemo(() => {
    if (!typeFilter) return afterListFilter;
    return afterListFilter.filter((c) => c.analysis?.type === typeFilter);
  }, [afterListFilter, typeFilter]);

  const rowCommits = useMemo(() => {
    let rows = commitsForTimeline;
    if (dayFilter) {
      rows = rows.filter((c) => commitDayKeyLocal(c.date) === dayFilter);
    }
    return sortCommits(rows, sortMode);
  }, [commitsForTimeline, dayFilter, sortMode]);

  const onSelectDay = useCallback(
    (dayKey: string | null) => {
      setQuery({ day: dayKey });
    },
    [setQuery],
  );

  useEffect(() => {
    const q = highlightSha?.trim();
    if (!q) return;
    const match = baseCommits.find((c) => shaMatchesQuery(c.sha, q));
    if (!match) return;
    const key = commitRowKey(match);
    if (!rowCommits.some((c) => commitRowKey(c) === key)) return;
    const domId = commitRowDomId(match);
    const id = requestAnimationFrame(() => {
      setExpandedRowKey(key);
      requestAnimationFrame(() => {
        document.getElementById(domId)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    });
    return () => cancelAnimationFrame(id);
  }, [highlightSha, rowCommits, baseCommits]);
  const withAiCount = baseCommits.filter((c) => c.analysis).length;

  const toggleExpand = (rowKey: string) => {
    setExpandedRowKey((prev) => (prev === rowKey ? null : rowKey));
  };

  if (baseCommits.length === 0) {
    return (
      <div className="glass-surface p-8 text-center">
        <Brain className="w-8 h-8 text-gray-500 mx-auto mb-3" />
        <p className="text-sm text-gray-400">No commits in this window (merge-only or empty).</p>
      </div>
    );
  }

  const configured = aiDiagnostics?.openrouterConfigured ?? aiPowered ?? false;
  const failures = aiDiagnostics?.modelCallFailures ?? 0;
  const errs = aiDiagnostics?.recentErrors ?? [];
  const showAiFailureCallout =
    withAiCount === 0 && configured && baseCommits.length > 0 && failures > 0;

  const withAiInView = rowCommits.filter((c) => c.analysis).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 ring-1 ring-white/10">
          <Brain className="w-5 h-5 text-purple-300" />
        </div>
        <h2 className="text-2xl font-semibold text-white tracking-tight">Commit timeline</h2>
        <span className="text-[10px] px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-200 font-medium border border-purple-500/25">
          {withAiInView}/{rowCommits.length} with AI
        </span>
        {modelsUsed.length > 0 && (
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400 ml-auto">
            {modelsUsed.map((m) => m.split("/").pop()).join(" → ")}
          </span>
        )}
      </div>

      <div className="flex flex-col lg:flex-row lg:flex-wrap gap-3 items-stretch lg:items-end">
        <label className="flex flex-col gap-1 min-w-[160px]">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Contribution type</span>
          <select
            value={typeFilter ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setQuery({ type: v || null, day: null });
            }}
            className="rounded-lg border border-white/10 bg-slate-950/80 text-sm text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/40 cursor-pointer"
          >
            <option value="">All types</option>
            {CONTRIBUTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 min-w-[180px]">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Sort</span>
          <select
            value={sortMode}
            onChange={(e) => setQuery({ sort: e.target.value })}
            className="rounded-lg border border-white/10 bg-slate-950/80 text-sm text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/40 cursor-pointer"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1 min-w-[200px]">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">AI status</span>
          <div className="flex rounded-lg border border-white/10 bg-slate-950/80 p-0.5">
            <button
              type="button"
              onClick={() => setCommitListFilter("all")}
              className={`flex-1 text-xs px-2 py-1.5 rounded-md transition-colors cursor-pointer ${
                commitListFilter === "all" ?
                  "bg-purple-500/25 text-white"
                : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setCommitListFilter("analyzed")}
              className={`flex-1 text-xs px-2 py-1.5 rounded-md transition-colors cursor-pointer ${
                commitListFilter === "analyzed" ?
                  "bg-purple-500/25 text-white"
                : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Analyzed ({withAiCount})
            </button>
          </div>
        </div>
      </div>

      <CommitsTimelineChart
        commits={commitsForTimeline}
        selectedDayKey={dayFilter}
        onSelectDay={onSelectDay}
      />

      {withAiCount === 0 && baseCommits.length > 0 && !showAiFailureCallout && !configured ? (
        <div className="glass-surface p-6 text-center text-sm text-gray-400">
          <p>
            Showing GitHub commits only. Set <code className="text-zinc-400">OPENROUTER_API_KEY</code> on the
            API server (devimpact-backend) and use <strong className="text-zinc-300">Run AI analysis</strong>{" "}
            to score commits.
          </p>
        </div>
      ) : null}

      {rowCommits.length === 0 && baseCommits.length > 0 ? (
        <div className="glass-surface p-5 text-center text-sm text-zinc-400">
          No commits match the current type or day filters.{" "}
          <button
            type="button"
            className="text-purple-400 hover:text-blue-300 underline cursor-pointer"
            onClick={() => setQuery({ type: null, day: null })}
          >
            Clear filters
          </button>
        </div>
      ) : null}

      {showAiFailureCallout ? (
        <div className="glass-surface p-6 text-left max-w-xl mx-auto space-y-2">
          <p className="text-xs text-amber-400/90 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              OpenRouter is configured, but model calls failed ({failures} failures, {baseCommits.length}{" "}
              commits). Check credits on{" "}
              <a
                href="https://openrouter.ai/settings/credits"
                className="text-purple-400 underline hover:text-blue-300 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                openrouter.ai/settings/credits
              </a>
              .
            </span>
          </p>
          {errs.length > 0 && (
            <ul className="text-[11px] text-zinc-500 font-mono bg-black/30 rounded-lg p-3 space-y-1 overflow-x-auto">
              {errs.slice(-5).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {rowCommits.length > 0 ?
        <div className="glass-surface overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-4 w-10 bg-white/[0.03]" aria-label="Expand" />
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-4 bg-white/[0.03]">When</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-4 bg-white/[0.03]">Commit</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-4 bg-white/[0.03]">Repo</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-4 bg-white/[0.03]">Type</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-4 bg-white/[0.03]">Impact</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-4 bg-white/[0.03]">Score</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-4 min-w-[200px] bg-white/[0.03]">
                  AI reasoning
                </th>
              </tr>
            </thead>
            <tbody>
              {rowCommits.map((commit) => {
                const a = commit.analysis;
                const rowKey = commitRowKey(commit);
                const expanded = expandedRowKey === rowKey;
                return (
                  <Fragment key={rowKey}>
                    <tr
                      id={commitRowDomId(commit)}
                      className="border-b border-white/5 hover:bg-white/[0.04] align-top transition-colors duration-300 scroll-mt-24"
                    >
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => toggleExpand(rowKey)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                          aria-expanded={expanded}
                          title={expanded ? "Collapse detail" : "Expand detail"}
                        >
                          {expanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <p className="text-[11px] text-zinc-300 tabular-nums">
                          {formatCommitDateTime(commit.date)}
                        </p>
                      </td>
                      <td className="px-3 py-3 max-w-[220px]">
                        <p className="text-white text-xs font-mono line-clamp-2">
                          {commit.message.split("\n")[0]}
                        </p>
                        <p className="text-[10px] text-zinc-600 mt-0.5 font-mono">
                          {commit.sha.substring(0, 7)} · {commit.author}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-zinc-300">
                          {commit.repoLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {a ? (
                          <span className={`text-[11px] font-medium ${typeColors[a.type] ?? "text-zinc-400"}`}>
                            {a.type}
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {a ? (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full ${impactColors[a.impact_level] ?? impactColors.medium}`}
                          >
                            {a.impact_level}
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {a ? (
                          <>
                            <span className="text-xs font-bold text-white tabular-nums">
                              {a.business_impact_score}
                            </span>
                            <span className="text-[10px] text-zinc-500">/100</span>
                          </>
                        ) : (
                          <span className="text-[11px] text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 max-w-[280px]">
                        {a ? (
                          <p className={`text-[11px] text-zinc-400 leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
                            {a.score_justification ?? a.reasoning}
                          </p>
                        ) : (
                          <p className="text-[11px] text-zinc-600">Run AI analysis for scoring</p>
                        )}
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-white/5 bg-purple-500/[0.06]">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="rounded-[16px] border border-white/10 bg-slate-950/80 backdrop-blur-xl p-5 space-y-3 shadow-inner">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="text-zinc-500">Commit detail</span>
                              <span className="text-zinc-600">·</span>
                              <span className="text-zinc-400">{formatCommitDateTime(commit.date)}</span>
                              <span className="text-zinc-600">·</span>
                              <span className="text-zinc-400 font-mono">{commit.sha}</span>
                              <span className="text-zinc-600">·</span>
                              <span className="text-zinc-400">{commit.repo}</span>
                            </div>
                            <p className="text-sm text-white font-mono whitespace-pre-wrap break-words">
                              {commit.message}
                            </p>
                            {commit.filesChanged.length > 0 && (
                              <div>
                                <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">
                                  Files ({commit.filesChanged.length})
                                </p>
                                <ul className="text-xs text-zinc-400 font-mono max-h-32 overflow-y-auto space-y-0.5">
                                  {commit.filesChanged.map((f) => (
                                    <li key={f}>{f}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {a ? (
                              <>
                                <div>
                                  <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">
                                    AI summary
                                  </p>
                                  <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                                    {a.reasoning}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[11px] uppercase tracking-wider text-purple-300 mb-1">
                                    Why this score ({a.business_impact_score}/100)
                                  </p>
                                  <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap border-l-2 border-purple-500/40 pl-3">
                                    {a.score_justification ?? a.reasoning}
                                  </p>
                                </div>
                                {(a.parameters_considered?.length ?? 0) > 0 && (
                                  <div>
                                    <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">
                                      Parameters considered
                                    </p>
                                    <ul className="text-sm text-zinc-400 list-disc list-inside space-y-0.5">
                                      {(a.parameters_considered ?? []).map((p, i) => (
                                        <li key={i}>{p}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {(a.affected_modules_and_flows?.length ?? 0) > 0 && (
                                  <div>
                                    <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">
                                      Modules &amp; flows impacted
                                    </p>
                                    <ul className="text-sm text-amber-200/80 list-disc list-inside space-y-0.5">
                                      {(a.affected_modules_and_flows ?? []).map((p, i) => (
                                        <li key={i}>{p}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </>
                            ) : (
                              <p className="text-sm text-zinc-500">
                                No AI layer for this commit yet. Use <strong className="text-zinc-400">Run AI analysis</strong>{" "}
                                in the header (OpenRouter required).
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={() => setExpandedRowKey(null)}
                              className="text-xs text-purple-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer transition-colors duration-300"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                              Collapse
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      : null}
    </div>
  );
}
