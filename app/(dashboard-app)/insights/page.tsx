"use client";

import Leaderboard from "@/app/components/Leaderboard";
import ContributionCharts from "@/app/components/ContributionCharts";
import TeamInsights from "@/app/components/TeamInsights";
import InsightSummaryCards from "@/app/components/InsightSummaryCards";
import { useAnalysisSession } from "@/components/AnalysisSessionProvider";

export default function InsightsPage() {
  const { result, selectedDev } = useAnalysisSession();
  if (!result) return null;

  return (
    <div className="space-y-8">
      <InsightSummaryCards result={result} />

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
            <Leaderboard entries={result.leaderboard} />
            <div className="h-px bg-white/10" />
            <TeamInsights insights={result.teamInsights} topContributor={result.topContributor} />
          </div>
        </aside>

        <div className="xl:col-span-8">
          <ContributionCharts result={result} selectedDeveloper={selectedDev} />
        </div>
      </div>
    </div>
  );
}
