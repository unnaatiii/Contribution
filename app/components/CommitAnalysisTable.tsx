"use client";

import { Fragment, useState } from "react";
import { Brain, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import type { AnalyzedCommit, AIAnalysisDiagnostics } from "@/lib/types";
import { formatCommitDateTime } from "@/lib/format-commit-date";

interface CommitAnalysisTableProps {
  analyzedCommits: AnalyzedCommit[];
  modelsUsed: string[];
  aiPowered?: boolean;
  aiDiagnostics?: AIAnalysisDiagnostics;
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

export default function CommitAnalysisTable({
  analyzedCommits,
  modelsUsed,
  aiPowered,
  aiDiagnostics,
}: CommitAnalysisTableProps) {
  const [expandedSha, setExpandedSha] = useState<string | null>(null);

  const realCommits = analyzedCommits.filter((c) => !c.isMergeCommit && c.analysis);
  const eligible = analyzedCommits.filter((c) => !c.isMergeCommit).length;

  const toggleExpand = (sha: string) => {
    setExpandedSha((prev) => (prev === sha ? null : sha));
  };

  if (realCommits.length === 0) {
    const configured = aiDiagnostics?.openrouterConfigured ?? aiPowered ?? false;
    const failures = aiDiagnostics?.modelCallFailures ?? 0;
    const errs = aiDiagnostics?.recentErrors ?? [];

    return (
      <div className="glass-surface p-8 text-center">
        <Brain className="w-8 h-8 text-gray-500 mx-auto mb-3" />
        <p className="text-sm text-gray-400">No AI analysis results for this run.</p>
        {!configured ? (
          <p className="text-xs text-zinc-600 mt-2 max-w-md mx-auto">
            Copy <code className="text-zinc-400">.env.example</code> to{" "}
            <code className="text-zinc-400">.env.local</code> and set{" "}
            <code className="text-zinc-400">OPENROUTER_API_KEY</code> on one line (no broken quotes).
            Restart <code className="text-zinc-400">npm run dev</code>.
          </p>
        ) : (
          <div className="mt-3 text-left max-w-xl mx-auto space-y-2">
            <p className="text-xs text-amber-400/90 flex items-start gap-2 justify-center">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                OpenRouter key is loaded, but every model call failed or returned unusable JSON (
                {failures} failed calls, {eligible} commits eligible). Check credits / rate limits on{" "}
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
        )}
      </div>
    );
  }

  const successCount = realCommits.filter((c) => c.analysis).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 ring-1 ring-white/10">
          <Brain className="w-5 h-5 text-purple-300" />
        </div>
        <h2 className="text-2xl font-semibold text-white tracking-tight">AI Commit Analysis</h2>
        <span className="text-[10px] px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-200 font-medium border border-purple-500/25">
          {successCount}/{eligible} analyzed
        </span>
        {modelsUsed.length > 0 && (
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400 ml-auto">
            {modelsUsed.map((m) => m.split("/").pop()).join(" → ")}
          </span>
        )}
      </div>

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
              {realCommits.map((commit) => {
                const a = commit.analysis!;
                const expanded = expandedSha === commit.sha;
                return (
                  <Fragment key={commit.sha}>
                    <tr
                      className="border-b border-white/5 hover:bg-white/[0.04] align-top transition-colors duration-300"
                    >
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => toggleExpand(commit.sha)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                          aria-expanded={expanded}
                          title={expanded ? "Collapse analysis" : "Expand full analysis"}
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
                        <span className={`text-[11px] font-medium ${typeColors[a.type] ?? "text-zinc-400"}`}>
                          {a.type}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${impactColors[a.impact_level] ?? impactColors.medium}`}
                        >
                          {a.impact_level}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-xs font-bold text-white tabular-nums">
                          {a.business_impact_score}
                        </span>
                        <span className="text-[10px] text-zinc-500">/100</span>
                      </td>
                      <td className="px-3 py-3 max-w-[280px]">
                        <p className={`text-[11px] text-zinc-400 leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
                          {a.score_justification ?? a.reasoning}
                        </p>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-white/5 bg-purple-500/[0.06]">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="rounded-[16px] border border-white/10 bg-slate-950/80 backdrop-blur-xl p-5 space-y-3 shadow-inner">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="text-zinc-500">Full AI analysis</span>
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
                            <div>
                              <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">
                                Summary
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
                            <button
                              type="button"
                              onClick={() => setExpandedSha(null)}
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
    </div>
  );
}
