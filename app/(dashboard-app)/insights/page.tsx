"use client";

import { useMemo } from "react";
import Link from "next/link";
import Leaderboard from "@/app/components/Leaderboard";
import ContributionCharts from "@/app/components/ContributionCharts";
import TeamInsights from "@/app/components/TeamInsights";
import InsightSummaryCards from "@/app/components/InsightSummaryCards";
import { useAnalysisSession } from "@/components/AnalysisSessionProvider";
import type { AnalysisResult } from "@/lib/types";
import { commitTableStats } from "@/lib/analyzed-commit-stats";

function insightsHeadingDetail(result: AnalysisResult) {
  const labels = result.repos?.map((r) => r.label).filter(Boolean) ?? [];
  const repoText =
    labels.length === 0
      ? "—"
      : labels.length <= 6
        ? labels.join(", ")
        : `${labels.slice(0, 5).join(", ")} +${labels.length - 5} more`;
  const w = result.analysisWindow;
  const dateText = w ? `${w.from} → ${w.to}` : "—";
  const analyzed = result.analyzedAt
    ? new Date(result.analyzedAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

  const { nonMergeInView, analyzedWithAi } = commitTableStats(result.analyzedCommits);

  return (
    <div className="text-sm text-zinc-400 leading-relaxed max-w-4xl pl-5 border-l border-white/15 space-y-1.5">
      <p>
        <span className="text-zinc-500 font-medium">Repos in this view:</span>{" "}
        <span className="text-zinc-300">{repoText}</span>
      </p>
      <p>
        <span className="text-zinc-500 font-medium">Analysis window:</span>{" "}
        <span className="text-zinc-300">{dateText}</span>
      </p>
      <p>
        <span className="text-zinc-500 font-medium">Commits in this view:</span>{" "}
        <span className="text-zinc-300 tabular-nums">
          {analyzedWithAi} with AI analysis · {nonMergeInView} non-merge total
        </span>
        <span className="text-zinc-500 text-xs block mt-0.5">
          (Same basis as the Commits tab — de-duplicated by repo + SHA.)
        </span>
      </p>
      <p className="text-xs text-zinc-500">Results from {analyzed}</p>
    </div>
  );
}

export default function InsightsPage() {
  const { result, dataResult, selectedDev, displayMode } = useAnalysisSession();
  const view = dataResult ?? result;
  if (!view) return null;

  const headingDetail = useMemo(() => insightsHeadingDetail(view), [view]);

  return (
    <div className="space-y-8">
      {displayMode === "restored" ? (
        <p className="text-sm text-amber-200/90 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
          You are viewing a <strong className="text-amber-100">saved analysis snapshot</strong>. All
          metrics below reflect that run&apos;s <code className="text-xs text-amber-200/80">analyzedCommits</code>{" "}
          and leaderboard. Use <strong className="text-amber-100">Return to live org view</strong> in the header
          to go back to the full merged dashboard, or run a new analysis from the Analysis tab.
        </p>
      ) : (
        <p className="text-sm text-zinc-400">
          Leaderboard and charts follow the <strong className="text-zinc-300">live</strong> session (wide org
          data merged with your latest AI run when applicable).
          Open <strong className="text-zinc-300">Previously analyzed</strong> on the{" "}
          <Link href="/analysis" className="text-purple-400 hover:text-blue-300 underline">
            Analysis
          </Link>{" "}
          page to open a saved run instead.
        </p>
      )}

      <InsightSummaryCards result={view} headingDetail={headingDetail} />

      <details className="glass-surface p-5 text-sm open:pb-6 group transition-all duration-300 hover:border-white/15">
        <summary className="cursor-pointer text-white font-medium list-none flex items-center gap-2 [&::-webkit-details-marker]:hidden">
          <span className="text-purple-400 transition-transform duration-300 group-open:rotate-90 inline-block">
            ▸
          </span>
          How impact scores work (commits vs leaderboard)
        </summary>
        <div className="mt-4 text-gray-400 leading-relaxed space-y-3 pl-6 border-l border-white/10">
          <p>
            <span className="text-gray-300">Per-commit AI score (e.g. 60/100):</span> the model explains{" "}
            <strong className="text-white">why</strong> that number in <em>Why this score</em>, lists{" "}
            <em>parameters considered</em>, and maps <em>modules &amp; flows</em> affected. Expand any
            row on the <strong className="text-white">Commits</strong> page to read the full breakdown.
          </p>
          <p>
            <span className="text-gray-300">Leaderboard total impact:</span> not commit count. Each scored
            commit adds{" "}
            <code className="text-xs bg-black/40 px-2 py-0.5 rounded-lg border border-white/10">
              typeWeight × impactMultiplier × repoWeight + 0.3 × businessScore
            </code>
            . A frontend developer with fewer commits can still lead if those commits carry high business
            scores, cross cutting user flows, or span multiple repos (higher aggregate weight).
          </p>
        </div>
      </details>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <aside className="xl:col-span-4 space-y-6 xl:sticky xl:top-[5.5rem] xl:self-start">
          <div className="glass-surface p-6 space-y-8">
            <Leaderboard entries={view.leaderboard} />
            <div className="h-px bg-white/10" />
            <TeamInsights insights={view.teamInsights} topContributor={view.topContributor} />
          </div>
        </aside>

        <div className="xl:col-span-8">
          <ContributionCharts result={view} selectedDeveloper={selectedDev} />
        </div>
      </div>
    </div>
  );
}
