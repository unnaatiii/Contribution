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
import { recordDeveloperProfileTransition } from "@/animations/profileTransition";

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
    color: "text-blue-300 bg-blue-500/10 border-blue-500/25",
  },
  management: {
    icon: <ShieldCheck className="w-4 h-4" />,
    color: "text-purple-200 bg-purple-500/10 border-purple-500/25",
  },
  discovery: {
    icon: <Eye className="w-4 h-4" />,
    color: "text-indigo-200 bg-indigo-500/10 border-indigo-500/25",
  },
  focus: {
    icon: <Target className="w-4 h-4" />,
    color: "text-violet-200 bg-violet-500/10 border-violet-500/25",
  },
};

export default function TeamInsights({ insights, topContributor }: TeamInsightsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/15 ring-1 ring-white/10">
          <Users className="w-5 h-5 text-blue-300" />
        </div>
        <h2 className="text-2xl font-semibold text-white tracking-tight">Team Insights</h2>
      </div>

      {topContributor && (
        <Link
          href={`/developer/${encodeURIComponent(topContributor.developer.login)}`}
          scroll={false}
          onClick={(e) =>
            recordDeveloperProfileTransition(e.currentTarget, topContributor.developer.login)
          }
          className="block glass-surface glass-surface--lift-sm bg-gradient-to-r from-amber-500/10 via-amber-600/5 to-transparent border-amber-500/25 p-5"
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
                  <p className="text-xs text-gray-400">
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

      <div className="grid grid-cols-1 gap-4">
        {insights.map((insight, idx) => {
          const config = categoryConfig[insight.category] ?? categoryConfig.focus;
          return (
            <div
              key={idx}
              className={`glass-surface glass-surface--lift-sm p-5 ${config.color} transition-all duration-300`}
            >
              <div className="flex items-center gap-2 mb-2">
                {config.icon}
                <h3 className="text-sm font-medium text-white">{insight.title}</h3>
              </div>
              <p className="text-xs leading-relaxed text-gray-400 mb-3">
                {insight.description}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {insight.developers.map((dev) => (
                  <Link
                    key={dev}
                    href={`/developer/${encodeURIComponent(dev)}`}
                    scroll={false}
                    onClick={(e) => recordDeveloperProfileTransition(e.currentTarget, dev)}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white transition-all duration-300 border border-white/5"
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
