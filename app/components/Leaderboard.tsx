"use client";

import { useState } from "react";
import Link from "next/link";
import { Trophy, TrendingUp, Award, Shield } from "lucide-react";
import type { LeaderboardEntry } from "@/lib/types";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

const tierColors: Record<string, string> = {
  exceptional: "from-amber-500/20 to-amber-600/10 border-amber-500/30",
  high: "from-accent/15 to-accent/5 border-accent/30",
  medium: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
  growing: "from-zinc-500/20 to-zinc-600/10 border-zinc-500/30",
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
      <div className="text-center py-12 text-zinc-500">
        No developer data available yet.
      </div>
    );
  }

  return (
    <div
      className="space-y-3"
      onMouseLeave={() => setHoveredLogin(null)}
    >
      <div className="flex items-center gap-2 mb-6 animate-fade-rise">
        <Trophy className="w-5 h-5 text-amber-400" />
        <h2 className="text-lg font-semibold text-white">Impact Leaderboard</h2>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 ml-auto">
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
            onMouseEnter={() => setHoveredLogin(dev.login)}
            className={`relative block bg-gradient-to-r ${tierStyle} border rounded-xl p-4 transition-all duration-300 ease-out hover:scale-[1.01] hover:ring-1 hover:ring-accent/25 ${
              dimOthers ? "blur-[3px] opacity-40 scale-[0.99]" : ""
            }`}
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
                  <span className="text-white font-medium truncate">{dev.login}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${
                      dev.tier === "exceptional"
                        ? "bg-amber-500/20 text-amber-400"
                        : dev.tier === "high"
                          ? "bg-accent/20 text-accent"
                          : dev.tier === "medium"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-zinc-500/20 text-zinc-400"
                    }`}
                  >
                    {tierLabels[dev.tier]}
                  </span>
                  {entry.badge && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent/90 font-medium">
                      <Award className="w-3 h-3 inline mr-0.5" />
                      {entry.badge}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
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
                <div className="flex items-center gap-1.5 text-accent">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xl font-bold tabular-nums">
                    {dev.impactScore}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
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
