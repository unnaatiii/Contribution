"use client";

import {
  GitCommit,
  Bug,
  Sparkles,
  Wrench,
  Settings,
  FlaskConical,
  Eye,
  FolderGit2,
  UserCheck,
  ChevronRight,
} from "lucide-react";
import type { DeveloperProfile } from "@/lib/types";
import Link from "next/link";

interface ContributorCardProps {
  developer: DeveloperProfile;
  isSelected: boolean;
  /** When set, other cards are visually de-emphasized */
  hoveredLogin: string | null;
  onHoverLogin: (login: string | null) => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  feature: <Sparkles className="w-3.5 h-3.5" />,
  bug_fix: <Bug className="w-3.5 h-3.5" />,
  refactor: <Wrench className="w-3.5 h-3.5" />,
  test: <FlaskConical className="w-3.5 h-3.5" />,
  chore: <Settings className="w-3.5 h-3.5" />,
};

const typeColorClasses: Record<string, string> = {
  feature: "text-accent bg-accent/10",
  bug_fix: "text-red-400 bg-red-500/10",
  refactor: "text-emerald-400 bg-emerald-500/10",
  test: "text-purple-400 bg-purple-500/10",
  chore: "text-zinc-400 bg-zinc-500/10",
};

export default function ContributorCard({
  developer,
  isSelected,
  hoveredLogin,
  onHoverLogin,
}: ContributorCardProps) {
  const breakdownEntries = Object.entries(developer.breakdown).filter(
    ([, count]) => count > 0,
  );

  const isDimmed = hoveredLogin !== null && hoveredLogin !== developer.login;
  const isHighlighted = hoveredLogin === developer.login;

  const href = `/developer/${encodeURIComponent(developer.login)}`;

  return (
    <Link
      href={href}
      scroll
      className={`block w-full text-left rounded-xl transition-all duration-300 ease-out outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] ${
        isDimmed ? "blur-[2.5px] opacity-[0.42] scale-[0.98]" : "opacity-100 scale-100"
      } ${isHighlighted ? "z-10 relative scale-[1.02] shadow-xl shadow-accent/20" : ""}`}
      onMouseEnter={() => onHoverLogin(developer.login)}
    >
      <div
        className={`bg-white/5 border rounded-xl p-5 transition-colors h-full ${
          isSelected
            ? "border-accent/50 ring-1 ring-accent/20"
            : "border-white/10 hover:border-accent/30 hover:bg-white/[0.08]"
        } ${isHighlighted ? "border-accent/40 bg-white/[0.08]" : ""}`}
      >
        <div className="flex items-start gap-3.5 mb-4">
          <img
            src={developer.avatar_url}
            alt={developer.login}
            className="w-11 h-11 rounded-full ring-2 ring-white/10"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-medium truncate">{developer.login}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  developer.role === "manager"
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-emerald-500/20 text-emerald-400"
                }`}
              >
                {developer.role === "manager" ? "Manager" : "Developer"}
              </span>
              <span className="ml-auto flex items-center gap-0.5 text-[11px] text-accent font-medium shrink-0">
                Profile
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <GitCommit className="w-3 h-3" />
                {developer.meaningfulCommits}
              </span>
              <span className="flex items-center gap-1">
                <FolderGit2 className="w-3 h-3" />
                {developer.reposContributed.length} repos
              </span>
              {developer.totalReviews > 0 && (
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {developer.totalReviews}
                </span>
              )}
              {developer.prsApproved > 0 && (
                <span className="flex items-center gap-1">
                  <UserCheck className="w-3 h-3" />
                  {developer.prsApproved}
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xl font-bold text-amber-400 tabular-nums">
              {developer.impactScore}
            </div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Impact</div>
          </div>
        </div>

        {developer.reposContributed.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {developer.reposContributed.map((repo) => (
              <span
                key={repo}
                className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/5"
              >
                {repo}
                {developer.repoBreakdown[repo] && (
                  <span className="ml-1 text-zinc-500">({developer.repoBreakdown[repo].commits})</span>
                )}
              </span>
            ))}
          </div>
        )}

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

        {developer.avgBusinessImpact > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
              <span>Avg Business Impact</span>
              <span className="text-white font-medium">{developer.avgBusinessImpact}/100</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  developer.avgBusinessImpact >= 70
                    ? "bg-emerald-500"
                    : developer.avgBusinessImpact >= 40
                      ? "bg-amber-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${developer.avgBusinessImpact}%` }}
              />
            </div>
          </div>
        )}

        {developer.insights.length > 0 && (
          <div className="space-y-1 mt-3 pt-3 border-t border-white/5">
            {developer.insights.slice(0, 3).map((insight, i) => (
              <p key={i} className="text-xs text-zinc-400 leading-relaxed">
                {insight}
              </p>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
