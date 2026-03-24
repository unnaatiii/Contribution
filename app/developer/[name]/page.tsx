"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  GitCommit,
  FolderGit2,
  Eye,
  Brain,
  Sparkles,
  Bug,
  Wrench,
  FlaskConical,
  Settings,
  Shield,
  ChevronDown,
  ChevronUp,
  GitMerge,
} from "lucide-react";
import type { AnalysisResult, DeveloperProfile, AnalyzedCommit } from "@/lib/types";
import { formatCommitDateTime } from "@/lib/format-commit-date";

const typeColors: Record<string, string> = {
  feature: "text-accent bg-accent/10 border-accent/20",
  bug_fix: "text-red-400 bg-red-500/10 border-red-500/20",
  refactor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  test: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  chore: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
};

const typeIcons: Record<string, React.ReactNode> = {
  feature: <Sparkles className="w-4 h-4" />,
  bug_fix: <Bug className="w-4 h-4" />,
  refactor: <Wrench className="w-4 h-4" />,
  test: <FlaskConical className="w-4 h-4" />,
  chore: <Settings className="w-4 h-4" />,
};

const impactColors: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10",
  high: "text-amber-400 bg-amber-500/10",
  medium: "text-accent bg-accent/10",
  low: "text-zinc-400 bg-zinc-500/10",
};

export default function DeveloperPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = use(params);
  const devName = decodeURIComponent(name);
  const [developer, setDeveloper] = useState<DeveloperProfile | null>(null);
  const [commits, setCommits] = useState<AnalyzedCommit[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSha, setExpandedSha] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("devimpact-result");
    if (stored) {
      try {
        const result: AnalysisResult = JSON.parse(stored);
        const dev = result.developers.find(
          (d) => d.login.toLowerCase() === devName.toLowerCase(),
        );
        if (dev) {
          setDeveloper(dev);
          setCommits(
            result.analyzedCommits.filter(
              (c) => c.author.toLowerCase() === devName.toLowerCase(),
            ),
          );
        }
      } catch {
        /* ignore */
      }
    }
    setLoading(false);
  }, [devName]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (!developer) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-xl text-white mb-2">Developer not found</h2>
          <p className="text-zinc-400 mb-6 text-sm">
            Run an analysis first, then open a profile from the dashboard.
          </p>
          <Link
            href="/"
            className="inline-flex px-5 py-2.5 bg-accent text-white rounded-xl text-sm hover:bg-accent-hover transition-colors"
          >
            Back to leaderboard
          </Link>
        </div>
      </div>
    );
  }

  const timelineAll = [...commits].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const repoEntries = Object.entries(developer.repoBreakdown).sort(
    ([, a], [, b]) => b.score - a.score,
  );

  const featureCommits = timelineAll.filter((c) => !c.isMergeCommit && c.analysis?.type === "feature");

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-50 bg-[var(--background)]/85 backdrop-blur-xl border-b border-[var(--cursor-border-subtle)] px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 p-2 pr-3 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-sm"
          >
            <ArrowLeft className="w-5 h-5 shrink-0" />
            <span className="hidden sm:inline">Back to leaderboard</span>
          </Link>
          <img
            src={developer.avatar_url}
            alt={developer.login}
            className="w-10 h-10 rounded-full ring-2 ring-white/10"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-white">{developer.login}</h1>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                  developer.role === "manager"
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-emerald-500/20 text-emerald-400"
                }`}
              >
                {developer.role}
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              {developer.reposContributed.join(", ")} · {timelineAll.length} commits in this analysis window
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            {
              label: "Impact Score",
              value: developer.impactScore,
              icon: <Shield className="w-4 h-4 text-amber-400" />,
            },
            {
              label: "Commits",
              value: developer.meaningfulCommits,
              icon: <GitCommit className="w-4 h-4 text-accent" />,
            },
            {
              label: "Repos",
              value: developer.reposContributed.length,
              icon: <FolderGit2 className="w-4 h-4 text-cyan-400" />,
            },
            {
              label: "Reviews",
              value: developer.totalReviews,
              icon: <Eye className="w-4 h-4 text-purple-400" />,
            },
            {
              label: "Avg Impact",
              value: `${developer.avgBusinessImpact}/100`,
              icon: <Brain className="w-4 h-4 text-emerald-400" />,
            },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                {stat.icon}
                <span className="text-xs text-zinc-400">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-white tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-300 mb-4">Contribution Breakdown</h3>
            <div className="space-y-3">
              {Object.entries(developer.breakdown)
                .filter(([, v]) => v > 0)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => {
                  const total = developer.meaningfulCommits || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={type}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="flex items-center gap-2 text-zinc-300">
                          {typeIcons[type]}
                          {type}
                        </span>
                        <span className="text-zinc-400">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent/70"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-300 mb-4">Repo-wise Contribution</h3>
            <div className="space-y-4">
              {repoEntries.map(([repo, data]) => (
                <div key={repo} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white font-medium">{repo}</p>
                    <p className="text-xs text-zinc-500">{data.commits} commits</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-amber-400 tabular-nums">
                      {Math.round(data.score)}
                    </p>
                    <p className="text-[10px] text-zinc-500">score</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {featureCommits.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-8">
            <h3 className="text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              Features Worked On ({featureCommits.length})
            </h3>
            <div className="space-y-2">
              {featureCommits.map((c) => (
                <div key={c.sha} className="flex items-start gap-3 p-3 bg-white/[0.02] rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-mono">{c.message.split("\n")[0]}</p>
                    <p className="text-xs text-zinc-500 mt-1 tabular-nums">
                      {formatCommitDateTime(c.date)} · {c.repoLabel} · {c.sha.substring(0, 7)}
                    </p>
                  </div>
                  {c.analysis && (
                    <span className="text-xs font-bold text-amber-400 shrink-0 tabular-nums">
                      {c.analysis.business_impact_score}/100
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {developer.insights.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-8">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">AI Insights</h3>
            <div className="space-y-2">
              {developer.insights.map((insight, i) => (
                <p key={i} className="text-sm text-zinc-400 leading-relaxed">
                  {insight}
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="mb-8">
          <h3 className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-accent" />
            Contribution timeline
          </h3>
          <p className="text-xs text-zinc-500 mb-6">
            Newest first. Date and time are from Git author date. Use the arrow to expand full message,
            file list, and AI reasoning.
          </p>

          <div className="relative pl-2">
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-accent/50 via-white/10 to-transparent" />
            <div className="space-y-4">
              {timelineAll.map((commit) => {
                const expanded = expandedSha === commit.sha;
                const hasAnalysis = !!commit.analysis;
                return (
                  <div key={commit.sha} className="relative pl-8">
                    <div
                      className={`absolute left-0 top-3 w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center z-10 ${
                        commit.isMergeCommit
                          ? "border-amber-500/40 bg-zinc-900 text-amber-400"
                          : "border-accent/50 bg-zinc-900 text-accent/85"
                      }`}
                    >
                      {commit.isMergeCommit ? (
                        <GitMerge className="w-3 h-3" />
                      ) : (
                        <GitCommit className="w-3 h-3" />
                      )}
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                      <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <time
                              className="text-xs font-medium text-accent/90 tabular-nums"
                              dateTime={commit.date}
                            >
                              {formatCommitDateTime(commit.date)}
                            </time>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-400">
                              {commit.repoLabel}
                            </span>
                            {commit.isMergeCommit && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                                Merge commit
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-white font-mono leading-snug break-words">
                            {commit.message.split("\n")[0]}
                          </p>
                          <p className="text-[10px] text-zinc-600 font-mono mt-1">{commit.sha}</p>
                        </div>
                        {hasAnalysis && (
                          <button
                            type="button"
                            onClick={() => setExpandedSha(expanded ? null : commit.sha)}
                            className="shrink-0 flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover px-3 py-2 rounded-lg border border-accent/30 hover:bg-accent/10 transition-colors cursor-pointer self-start"
                          >
                            {expanded ? (
                              <>
                                <ChevronUp className="w-4 h-4" />
                                Collapse
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4" />
                                Full analysis
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {hasAnalysis && !expanded && (
                        <div className="px-4 pb-3 -mt-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full border ${typeColors[commit.analysis!.type] ?? typeColors.chore}`}
                            >
                              {commit.analysis!.type}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full ${impactColors[commit.analysis!.impact_level] ?? impactColors.medium}`}
                            >
                              {commit.analysis!.impact_level}
                            </span>
                            <span className="text-xs font-bold text-amber-400 tabular-nums">
                              {commit.analysis!.business_impact_score}/100
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-2 line-clamp-2">
                            {commit.analysis!.score_justification ?? commit.analysis!.reasoning}
                          </p>
                        </div>
                      )}

                      {expanded && hasAnalysis && (
                        <div className="border-t border-white/10 bg-zinc-900/50 p-4 space-y-4">
                          <div>
                            <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">
                              Full commit message
                            </p>
                            <p className="text-sm text-zinc-200 font-mono whitespace-pre-wrap break-words">
                              {commit.message}
                            </p>
                          </div>
                          {commit.filesChanged.length > 0 && (
                            <div>
                              <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">
                                Files changed ({commit.filesChanged.length})
                              </p>
                              <ul className="text-xs text-zinc-400 font-mono max-h-40 overflow-y-auto space-y-0.5">
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
                              {commit.analysis!.reasoning}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wider text-accent/90 mb-1">
                              Why this score ({commit.analysis!.business_impact_score}/100)
                            </p>
                            <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap border-l-2 border-accent/40 pl-3">
                              {commit.analysis!.score_justification ?? commit.analysis!.reasoning}
                            </p>
                          </div>
                          {(commit.analysis!.parameters_considered?.length ?? 0) > 0 && (
                            <div>
                              <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">
                                Parameters considered
                              </p>
                              <ul className="text-sm text-zinc-400 list-disc list-inside space-y-0.5">
                                {(commit.analysis!.parameters_considered ?? []).map((p, i) => (
                                  <li key={i}>{p}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {(commit.analysis!.affected_modules_and_flows?.length ?? 0) > 0 && (
                            <div>
                              <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">
                                Modules &amp; flows impacted
                              </p>
                              <ul className="text-sm text-amber-200/80 list-disc list-inside space-y-0.5">
                                {(commit.analysis!.affected_modules_and_flows ?? []).map((p, i) => (
                                  <li key={i}>{p}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <p className="text-[11px] text-zinc-600">
                            Model: {commit.modelUsed} · {formatCommitDateTime(commit.date)}
                          </p>
                        </div>
                      )}

                      {commit.isMergeCommit && !hasAnalysis && (
                        <div className="px-4 pb-3 text-xs text-zinc-500">
                          Merge commits are not AI-scored; shown for a complete activity timeline.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
