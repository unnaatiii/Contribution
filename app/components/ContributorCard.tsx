"use client";

import {
  GitCommit,
  GitPullRequest,
  Bug,
  Sparkles,
  Wrench,
  FileText,
  Zap,
  Shield,
  Settings,
  FlaskConical,
} from "lucide-react";
import type { DeveloperProfile } from "@/lib/types";

interface ContributorCardProps {
  developer: DeveloperProfile;
  isSelected: boolean;
  onClick: () => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  feature: <Sparkles className="w-3.5 h-3.5" />,
  bugfix: <Bug className="w-3.5 h-3.5" />,
  refactor: <Wrench className="w-3.5 h-3.5" />,
  documentation: <FileText className="w-3.5 h-3.5" />,
  test: <FlaskConical className="w-3.5 h-3.5" />,
  chore: <Settings className="w-3.5 h-3.5" />,
  performance: <Zap className="w-3.5 h-3.5" />,
  security: <Shield className="w-3.5 h-3.5" />,
};

const typeColorClasses: Record<string, string> = {
  feature: "text-indigo-400 bg-indigo-500/10",
  bugfix: "text-red-400 bg-red-500/10",
  refactor: "text-emerald-400 bg-emerald-500/10",
  documentation: "text-amber-400 bg-amber-500/10",
  test: "text-purple-400 bg-purple-500/10",
  chore: "text-zinc-400 bg-zinc-500/10",
  performance: "text-cyan-400 bg-cyan-500/10",
  security: "text-orange-400 bg-orange-500/10",
};

export default function ContributorCard({
  developer,
  isSelected,
  onClick,
}: ContributorCardProps) {
  const breakdownEntries = Object.entries(developer.contributionBreakdown).filter(
    ([, count]) => count > 0,
  );

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white/5 border rounded-xl p-5 transition-all hover:bg-white/[0.07] cursor-pointer ${
        isSelected
          ? "border-indigo-500/50 ring-1 ring-indigo-500/20"
          : "border-white/10 hover:border-white/20"
      }`}
    >
      <div className="flex items-start gap-3.5 mb-4">
        <img
          src={developer.avatar_url}
          alt={developer.login}
          className="w-11 h-11 rounded-full ring-2 ring-white/10"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-medium truncate">{developer.login}</span>
            {developer.rank && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-500 tabular-nums">
                #{developer.rank}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <GitCommit className="w-3 h-3" />
              {developer.totalCommits}
            </span>
            <span className="flex items-center gap-1">
              <GitPullRequest className="w-3 h-3" />
              {developer.totalPRs}
            </span>
            <span>{developer.prAcceptanceRate}% merged</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xl font-bold text-amber-400 tabular-nums">
            {Math.round(developer.totalImpactScore)}
          </div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Impact</div>
        </div>
      </div>

      {breakdownEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {breakdownEntries.map(([type, count]) => (
            <span
              key={type}
              className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${typeColorClasses[type] ?? "text-zinc-400 bg-zinc-500/10"}`}
            >
              {typeIcons[type]}
              {type} ({count})
            </span>
          ))}
        </div>
      )}

      {developer.insights.length > 0 && (
        <div className="space-y-1.5 mt-3 pt-3 border-t border-white/5">
          {developer.insights.slice(0, 2).map((insight, i) => (
            <p
              key={i}
              className={`text-xs leading-relaxed ${
                insight.type === "highlight"
                  ? "text-emerald-400/80"
                  : insight.type === "strength"
                    ? "text-indigo-400/80"
                    : "text-amber-400/80"
              }`}
            >
              {insight.type === "highlight" ? "★" : insight.type === "strength" ? "↑" : "→"}{" "}
              {insight.message}
            </p>
          ))}
        </div>
      )}
    </button>
  );
}
