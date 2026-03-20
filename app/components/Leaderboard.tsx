"use client";

import { Trophy, TrendingUp, Award, ChevronUp, ChevronDown } from "lucide-react";
import type { LeaderboardEntry } from "@/lib/types";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

const tierColors: Record<string, string> = {
  exceptional: "from-amber-500/20 to-amber-600/10 border-amber-500/30",
  high: "from-indigo-500/20 to-indigo-600/10 border-indigo-500/30",
  medium: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
  growing: "from-zinc-500/20 to-zinc-600/10 border-zinc-500/30",
};

const tierLabels: Record<string, string> = {
  exceptional: "Exceptional",
  high: "High Impact",
  medium: "Solid",
  growing: "Growing",
};

const rankMedals = ["🥇", "🥈", "🥉"];

export default function Leaderboard({ entries }: LeaderboardProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500">
        No developer data available yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-6">
        <Trophy className="w-5 h-5 text-amber-400" />
        <h2 className="text-lg font-semibold text-white">Impact Leaderboard</h2>
      </div>

      {entries.map((entry) => {
        const dev = entry.developer;
        const tierStyle = tierColors[dev.tier] ?? tierColors.growing;

        return (
          <div
            key={dev.login}
            className={`relative bg-gradient-to-r ${tierStyle} border rounded-xl p-4 transition-all hover:scale-[1.01]`}
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 text-lg font-bold text-zinc-300 shrink-0">
                {entry.rank <= 3 ? rankMedals[entry.rank - 1] : `#${entry.rank}`}
              </div>

              <img
                src={dev.avatar_url}
                alt={dev.login}
                className="w-10 h-10 rounded-full ring-2 ring-white/10 shrink-0"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <a
                    href={dev.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white font-medium hover:text-indigo-300 transition-colors truncate"
                  >
                    {dev.login}
                  </a>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${
                      dev.tier === "exceptional"
                        ? "bg-amber-500/20 text-amber-400"
                        : dev.tier === "high"
                          ? "bg-indigo-500/20 text-indigo-400"
                          : dev.tier === "medium"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-zinc-500/20 text-zinc-400"
                    }`}
                  >
                    {tierLabels[dev.tier]}
                  </span>
                  {entry.badge && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-medium">
                      <Award className="w-3 h-3 inline mr-0.5" />
                      {entry.badge}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 mt-1 text-xs text-zinc-400">
                  <span>{dev.totalCommits} commits</span>
                  <span>{dev.totalPRs} PRs</span>
                  <span className="flex items-center gap-0.5">
                    {dev.prAcceptanceRate >= 70 ? (
                      <ChevronUp className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-red-400" />
                    )}
                    {dev.prAcceptanceRate}% merge rate
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="flex items-center gap-1.5 text-amber-400">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xl font-bold tabular-nums">
                    {Math.round(dev.totalImpactScore)}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                  Impact Score
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
