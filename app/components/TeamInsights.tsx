"use client";

import Link from "next/link";
import {
  TrendingUp,
  Eye,
  Target,
  Trophy,
  Users,
  FolderGit2,
  ShieldCheck,
} from "lucide-react";
import type { TeamInsight, LeaderboardEntry } from "@/lib/types";

interface TeamInsightsProps {
  insights: TeamInsight[];
  topContributor: LeaderboardEntry | null;
}

const categoryConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  collaboration: {
    icon: <Users className="w-4 h-4" />,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
  impact: {
    icon: <TrendingUp className="w-4 h-4" />,
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  repo: {
    icon: <FolderGit2 className="w-4 h-4" />,
    color: "text-accent bg-accent/10 border-accent/20",
  },
  management: {
    icon: <ShieldCheck className="w-4 h-4" />,
    color: "text-accent/90 bg-accent/10 border-accent/20",
  },
  discovery: {
    icon: <Eye className="w-4 h-4" />,
    color: "text-accent/90 bg-accent/10 border-accent/20",
  },
  focus: {
    icon: <Target className="w-4 h-4" />,
    color: "text-accent bg-accent/10 border-accent/20",
  },
};

export default function TeamInsights({ insights, topContributor }: TeamInsightsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-accent" />
        <h2 className="text-lg font-semibold text-white">Team Insights</h2>
      </div>

      {topContributor && (
        <Link
          href={`/developer/${encodeURIComponent(topContributor.developer.login)}`}
          className="block bg-gradient-to-r from-amber-500/10 via-amber-600/5 to-transparent border border-amber-500/20 rounded-xl p-5 transition-all hover:border-amber-500/40 hover:ring-1 hover:ring-amber-500/20"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-amber-400/70 uppercase tracking-wider font-medium">
                Top Contributor — view profile
              </p>
              <div className="flex items-center gap-3 mt-1">
                <img
                  src={topContributor.developer.avatar_url}
                  alt={topContributor.developer.login}
                  className="w-8 h-8 rounded-full ring-2 ring-amber-500/30"
                />
                <div>
                  <p className="text-white font-semibold">{topContributor.developer.login}</p>
                  <p className="text-xs text-zinc-400">
                    Impact: {topContributor.developer.impactScore} ·{" "}
                    {topContributor.developer.meaningfulCommits} commits ·{" "}
                    {topContributor.developer.reposContributed.length} repos
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-3">
        {insights.map((insight, idx) => {
          const config = categoryConfig[insight.category] ?? categoryConfig.focus;
          return (
            <div key={idx} className={`border rounded-xl p-4 ${config.color}`}>
              <div className="flex items-center gap-2 mb-2">
                {config.icon}
                <h3 className="text-sm font-medium">{insight.title}</h3>
              </div>
              <p className="text-xs leading-relaxed opacity-80 mb-2">
                {insight.description}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {insight.developers.map((dev) => (
                  <Link
                    key={dev}
                    href={`/developer/${encodeURIComponent(dev)}`}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
                  >
                    @{dev}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
