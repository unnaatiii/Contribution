"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Crown, Eye, AlertTriangle, Flame } from "lucide-react";
import type { AnalysisResult, DeveloperProfile, LeaderboardEntry } from "@/lib/types";
import { contributorDisplayLabel } from "@/lib/commit-author";
import { formatIsoWeekLabel } from "@/lib/format-iso-week";
import { recordDeveloperProfileTransition } from "@/animations/profileTransition";

interface InsightSummaryCardsProps {
  result: AnalysisResult;
  /** Extra lines under the Insights title (repos + dates for the active view). */
  headingDetail?: ReactNode;
}

function devsOnly(developers: DeveloperProfile[]) {
  return developers.filter((d) => d.role === "developer");
}

function pickSummaries(
  developers: DeveloperProfile[],
  leaderboard: LeaderboardEntry[],
  analyzedAt: string,
) {
  const devs = devsOnly(developers);
  const used = new Set<string>();

  const boardFirst =
    leaderboard.find((e) => e.developer.role === "developer") ?? leaderboard[0];
  const mostImpactful = boardFirst?.developer.role === "developer"
    ? boardFirst.developer
    : devs.reduce<DeveloperProfile | null>((best, d) => {
        if (!best || d.impactScore > best.impactScore) return d;
        return best;
      }, null);
  if (mostImpactful) used.add(mostImpactful.login);

  const hiddenCandidates = devs
    .filter((d) => !used.has(d.login) && d.meaningfulCommits >= 2)
    .sort(
      (a, b) =>
        b.avgBusinessImpact - a.avgBusinessImpact ||
        b.impactScore / Math.max(1, b.meaningfulCommits) -
          a.impactScore / Math.max(1, a.meaningfulCommits),
    );
  const hiddenPerformer = hiddenCandidates[0] ?? null;
  if (hiddenPerformer) used.add(hiddenPerformer.login);

  const effortCandidates = devs
    .filter((d) => !used.has(d.login) && d.meaningfulCommits >= 3)
    .sort(
      (a, b) =>
        b.meaningfulCommits - a.meaningfulCommits ||
        a.avgBusinessImpact - b.avgBusinessImpact,
    );
  const highEffortLowImpact = effortCandidates[0] ?? null;
  if (highEffortLowImpact) used.add(highEffortLowImpact.login);

  const sprintCandidates = devs
    .filter((d) => !used.has(d.login))
    .sort((a, b) => b.meaningfulCommits - a.meaningfulCommits);
  const sprintLeader =
    sprintCandidates[0] ??
    [...devs].sort((a, b) => b.meaningfulCommits - a.meaningfulCommits)[0] ??
    null;

  const weekLabel = formatIsoWeekLabel(new Date(analyzedAt));

  return {
    mostImpactful,
    hiddenPerformer,
    highEffortLowImpact,
    sprintLeader,
    weekLabel,
  };
}

const cardStyles = {
  gold: {
    border: "border-amber-500/35",
    ring: "hover:shadow-[0_0_28px_-8px_rgba(245,158,11,0.35)]",
    iconWrap: "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25",
    metric: "text-amber-400",
  },
  green: {
    border: "border-emerald-500/35",
    ring: "hover:shadow-[0_0_28px_-8px_rgba(52,211,153,0.3)]",
    iconWrap: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25",
    metric: "text-emerald-400",
  },
  orange: {
    border: "border-orange-500/35",
    ring: "hover:shadow-[0_0_28px_-8px_rgba(249,115,22,0.3)]",
    iconWrap: "bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/25",
    metric: "text-orange-400",
  },
  rose: {
    border: "border-rose-500/35",
    ring: "hover:shadow-[0_0_28px_-8px_rgba(244,63,94,0.28)]",
    iconWrap: "bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25",
    metric: "text-rose-400",
  },
} as const;

export default function InsightSummaryCards({ result, headingDetail }: InsightSummaryCardsProps) {
  const { mostImpactful, hiddenPerformer, highEffortLowImpact, sprintLeader, weekLabel } =
    pickSummaries(result.developers, result.leaderboard, result.analyzedAt);

  const cards: Array<{
    key: string;
    label: string;
    icon: ReactNode;
    style: (typeof cardStyles)[keyof typeof cardStyles];
    dev: DeveloperProfile | null;
    primary: string;
    sub: string;
  }> = [
    {
      key: "most",
      label: "Most Impactful",
      icon: <Crown className="w-4 h-4" />,
      style: cardStyles.gold,
      dev: mostImpactful,
      primary: mostImpactful ? String(mostImpactful.impactScore) : "—",
      sub: mostImpactful
        ? `Highest total impact score with ${mostImpactful.meaningfulCommits} contribution${mostImpactful.meaningfulCommits === 1 ? "" : "s"}.`
        : "No developer data yet.",
    },
    {
      key: "hidden",
      label: "Hidden Performer",
      icon: <Eye className="w-4 h-4" />,
      style: cardStyles.green,
      dev: hiddenPerformer,
      primary: hiddenPerformer ? String(hiddenPerformer.impactScore) : "—",
      sub: hiddenPerformer
        ? `Strong average impact (${hiddenPerformer.avgBusinessImpact.toFixed(0)}/100) with ${hiddenPerformer.meaningfulCommits} contribution${hiddenPerformer.meaningfulCommits === 1 ? "" : "s"}.`
        : "Need at least two developers with 2+ commits.",
    },
    {
      key: "effort",
      label: "High Effort, Low Impact",
      icon: <AlertTriangle className="w-4 h-4" />,
      style: cardStyles.orange,
      dev: highEffortLowImpact,
      primary: highEffortLowImpact
        ? `${highEffortLowImpact.meaningfulCommits} commits · avg ${highEffortLowImpact.avgBusinessImpact.toFixed(2)}`
        : "—",
      sub: highEffortLowImpact
        ? "Many contributions with a lower average business impact per commit."
        : "Need another developer with 3+ commits.",
    },
    {
      key: "sprint",
      label: "Top Activity",
      icon: <Flame className="w-4 h-4" />,
      style: cardStyles.rose,
      dev: sprintLeader,
      primary: sprintLeader ? String(sprintLeader.impactScore) : "—",
      sub: sprintLeader
        ? `${weekLabel} · ${sprintLeader.meaningfulCommits} commits in this analysis window.`
        : "No extra high-activity contributor to highlight.",
    },
  ];

  return (
    <section className="mb-8">
      <div className="mb-6 space-y-3">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 shadow-lg shadow-purple-500/50" />
          <h2 className="text-2xl font-semibold text-white tracking-tight">Insights</h2>
        </div>
        {headingDetail}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6 summary-stagger">
        {cards.map((c) => {
          const s = c.style;
          const inner = (
            <>
              <div
                className={`mb-3 inline-flex rounded-lg p-2 ${s.iconWrap}`}
              >
                {c.icon}
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-2">
                {c.label}
              </p>
              {c.dev ? (
                <p
                  className="text-white font-semibold truncate"
                  title={contributorDisplayLabel(c.dev.login)}
                >
                  {contributorDisplayLabel(c.dev.login)}
                </p>
              ) : (
                <p className="text-zinc-500 text-sm">—</p>
              )}
              <p className={`mt-1 text-lg font-bold tabular-nums ${s.metric}`}>{c.primary}</p>
              <p className="mt-2 text-xs text-gray-400 leading-relaxed line-clamp-3">{c.sub}</p>
            </>
          );

          const shell = `relative glass-surface glass-surface--lift p-5 animate-fade-rise ${s.border} ${s.ring}`;

          if (c.dev) {
            return (
              <Link
                key={c.key}
                href={`/developer/${encodeURIComponent(c.dev.login)}`}
                scroll={false}
                onClick={(e) => recordDeveloperProfileTransition(e.currentTarget, c.dev!.login)}
                className={`${shell} block outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617]`}
              >
                {inner}
              </Link>
            );
          }

          return (
            <div key={c.key} className={`${shell} opacity-70`}>
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}
