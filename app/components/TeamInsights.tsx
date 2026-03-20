"use client";

import {
  TrendingUp,
  AlertTriangle,
  Eye,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import type { TeamInsight, LeaderboardEntry } from "@/lib/types";

interface TeamInsightsProps {
  insights: TeamInsight[];
  sprintTop: LeaderboardEntry | null;
}

const categoryConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  performance: {
    icon: <TrendingUp className="w-4 h-4" />,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
  opportunity: {
    icon: <AlertTriangle className="w-4 h-4" />,
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  discovery: {
    icon: <Eye className="w-4 h-4" />,
    color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  },
  focus: {
    icon: <Target className="w-4 h-4" />,
    color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  },
};

export default function TeamInsights({ insights, sprintTop }: TeamInsightsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-indigo-400" />
        <h2 className="text-lg font-semibold text-white">ROI Insights</h2>
      </div>

      {sprintTop && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-600/5 to-transparent border border-amber-500/20 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-amber-400/70 uppercase tracking-wider font-medium">
                Top Contributor of the Sprint
              </p>
              <div className="flex items-center gap-3 mt-1">
                <img
                  src={sprintTop.developer.avatar_url}
                  alt={sprintTop.developer.login}
                  className="w-8 h-8 rounded-full ring-2 ring-amber-500/30"
                />
                <div>
                  <p className="text-white font-semibold">{sprintTop.developer.login}</p>
                  <p className="text-xs text-zinc-400">
                    Impact Score: {Math.round(sprintTop.developer.totalImpactScore)} ·{" "}
                    {sprintTop.developer.totalCommits} commits ·{" "}
                    {sprintTop.developer.mergedPRs} merged PRs
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {insights.map((insight, idx) => {
          const config = categoryConfig[insight.category] ?? categoryConfig.focus;
          return (
            <div
              key={idx}
              className={`border rounded-xl p-4 ${config.color}`}
            >
              <div className="flex items-center gap-2 mb-2">
                {config.icon}
                <h3 className="text-sm font-medium">{insight.title}</h3>
              </div>
              <p className="text-xs leading-relaxed opacity-80 mb-2">
                {insight.description}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {insight.developers.map((dev) => (
                  <span
                    key={dev}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white/70"
                  >
                    @{dev}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
