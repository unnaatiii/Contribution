"use client";

import { useState } from "react";
import Link from "next/link";
import { Trophy, TrendingUp, Award, Shield } from "lucide-react";
import type { LeaderboardEntry } from "@/lib/types";
import { recordDeveloperProfileTransition } from "@/animations/profileTransition";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

const tierColors: Record<string, string> = {
  exceptional: "from-amber-500/20 to-amber-600/10 border-amber-500/30",
  high: "from-purple-500/20 to-blue-600/10 border-purple-500/35",
  medium: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
  growing: "from-slate-500/15 to-slate-600/10 border-white/10",
};

const tierLabels: Record<string, string> = {
  exceptional: "Exceptional",
  high: "High Impact",
  medium: "Solid",
  growing: "Growing",
};

const rankMedals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];

export default function Leaderboard({ entries }: LeaderboardProps) {
  const [hoveredLogin, setHoveredLogin] = useState<string | null>(null);

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        No developer data available yet.
      </div>
    );
  }

  return (
    <div
      className="space-y-3"
      onMouseLeave={() => setHoveredLogin(null)}
    >
      <div className="flex items-center gap-3 mb-6 animate-fade-rise">
        <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 ring-1 ring-white/10">
          <Trophy className="w-5 h-5 text-amber-400" />
        </div>
        <h2 className="text-2xl font-semibold text-white tracking-tight">Impact Leaderboard</h2>
        <span className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400 ml-auto">
          Developers only
        </span>
      </div>

      {entries.map((entry) => {
        const dev = entry.developer;
        const tierStyle = tierColors[dev.tier] ?? tierColors.growing;
        const dimOthers =
          hoveredLogin !== null && hoveredLogin !== dev.login;

        return (
          <Link
            key={dev.login}
            href={`/developer/${encodeURIComponent(dev.login)}`}
            scroll={false}
            onMouseEnter={() => setHoveredLogin(dev.login)}
            onClick={(e) => recordDeveloperProfileTransition(e.currentTarget, dev.login)}
            className={`relative block glass-surface glass-surface--lift-sm bg-gradient-to-r ${tierStyle} p-5 ${
              dimOthers ? "blur-[3px] opacity-40 scale-[0.99]" : ""
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-white/5 border border-white/10 text-lg font-bold text-gray-300 shrink-0">
                {entry.rank <= 3 ? rankMedals[entry.rank - 1] : `#${entry.rank}`}
              </div>

              <img
                src={dev.avatar_url}
                alt={dev.login}
                className="w-10 h-10 rounded-2xl ring-2 ring-white/10 shrink-0 object-cover shadow-lg"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium truncate">{dev.login}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${
                      dev.tier === "exceptional"
                        ? "bg-amber-500/20 text-amber-400"
                        : dev.tier === "high"
                          ? "bg-purple-500/20 text-purple-200"
                          : dev.tier === "medium"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-zinc-500/20 text-zinc-400"
                    }`}
                  >
                    {tierLabels[dev.tier]}
                  </span>
                  {entry.badge && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-200 font-medium border border-purple-500/20">
                      <Award className="w-3 h-3 inline mr-0.5" />
                      {entry.badge}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                  <span>{dev.meaningfulCommits} commits</span>
                  <span>{dev.reposContributed.length} repos</span>
                  {dev.totalReviews > 0 && <span>{dev.totalReviews} reviews</span>}
                  <span className="flex items-center gap-1 text-zinc-500">
                    <Shield className="w-3 h-3" />
                    avg {dev.avgBusinessImpact}/100
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  <span className="text-xl font-bold tabular-nums bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                    {dev.impactScore}
                  </span>
                </div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                  Impact
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
