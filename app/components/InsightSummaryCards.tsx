"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Crown, Eye, AlertTriangle, Flame } from "lucide-react";
import type { AnalysisResult, DeveloperProfile, LeaderboardEntry } from "@/lib/types";
import { formatIsoWeekLabel } from "@/lib/format-iso-week";

interface InsightSummaryCardsProps {
  result: AnalysisResult;
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

export default function InsightSummaryCards({ result }: InsightSummaryCardsProps) {
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
      label: "Sprint Leader",
      icon: <Flame className="w-4 h-4" />,
      style: cardStyles.rose,
      dev: sprintLeader,
      primary: sprintLeader ? String(sprintLeader.impactScore) : "—",
      sub: sprintLeader
        ? `${weekLabel} · ${sprintLeader.meaningfulCommits} commits in this analysis window.`
        : "No sprint-style activity to highlight.",
    },
  ];

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <span className="h-1 w-1 rounded-full bg-accent shadow-[0_0_12px_rgba(5,79,153,0.65)]" />
        <h2 className="text-lg font-semibold text-white tracking-tight">Insights</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 summary-stagger">
        {cards.map((c) => {
          const s = c.style;
          const inner = (
            <>
              <div
                className={`mb-3 inline-flex rounded-lg p-2 ${s.iconWrap}`}
              >
                {c.icon}
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8b949e] mb-2">
                {c.label}
              </p>
              {c.dev ? (
                <p className="text-white font-semibold truncate" title={c.dev.login}>
                  {c.dev.login}
                </p>
              ) : (
                <p className="text-zinc-500 text-sm">—</p>
              )}
              <p className={`mt-1 text-lg font-bold tabular-nums ${s.metric}`}>{c.primary}</p>
              <p className="mt-2 text-xs text-[#8b949e] leading-relaxed line-clamp-3">{c.sub}</p>
            </>
          );

          const shell = `relative rounded-xl border bg-[var(--cursor-panel)] p-4 transition-all duration-300 animate-fade-rise ${s.border} ${s.ring} hover:border-opacity-80`;

          if (c.dev) {
            return (
              <Link
                key={c.key}
                href={`/developer/${encodeURIComponent(c.dev.login)}`}
                className={`${shell} block outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]`}
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
