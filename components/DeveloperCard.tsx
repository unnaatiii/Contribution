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
import Link from "next/link";
import { motion } from "framer-motion";
import type { DeveloperProfile } from "@/lib/types";
import { getThemeForLogin } from "@/hooks/useDeveloperTheme";
import { recordDeveloperProfileTransition } from "@/animations/profileTransition";

export interface DeveloperCardProps {
  developer: DeveloperProfile;
  isSelected: boolean;
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
  feature: "text-purple-300 bg-purple-500/15",
  bug_fix: "text-red-400 bg-red-500/10",
  refactor: "text-emerald-400 bg-emerald-500/10",
  test: "text-purple-400 bg-purple-500/10",
  chore: "text-zinc-400 bg-zinc-500/10",
};

export default function DeveloperCard({
  developer,
  isSelected,
  hoveredLogin,
  onHoverLogin,
}: DeveloperCardProps) {
  const breakdownEntries = Object.entries(developer.breakdown).filter(([, count]) => count > 0);
  const isDimmed = hoveredLogin !== null && hoveredLogin !== developer.login;
  const isHighlighted = hoveredLogin === developer.login;
  const href = `/developer/${encodeURIComponent(developer.login)}`;
  const theme = getThemeForLogin(developer.login);

  return (
    <Link
      href={href}
      scroll={false}
      className={`block w-full text-left rounded-[20px] transition-all duration-300 ease-out outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617] ${
        isDimmed ? "blur-[2.5px] opacity-[0.42] scale-[0.98]" : "opacity-100 scale-100"
      } ${isHighlighted ? "z-10 relative scale-[1.02] shadow-2xl shadow-purple-500/20" : ""}`}
      onMouseEnter={() => onHoverLogin(developer.login)}
      onClick={(e) => recordDeveloperProfileTransition(e.currentTarget, developer.login)}
    >
      <motion.div
        layoutId={`developer-card-${developer.login}`}
        whileHover={isDimmed ? undefined : { scale: 1.02 }}
        whileTap={{ scale: 0.99 }}
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
        className={`glass-surface p-6 h-full border transition-all duration-300 ${
          isDimmed ? "" : "hover:shadow-2xl hover:border-white/20"
        } ${
          isSelected
            ? "border-purple-400/40 ring-1 ring-purple-500/30 shadow-lg shadow-purple-500/10"
            : "border-white/10"
        } ${isHighlighted ? "border-purple-400/50 bg-white/[0.07] shadow-xl shadow-purple-500/15" : ""}`}
        style={
          isHighlighted
            ? ({
                boxShadow: `0 25px 50px -12px rgba(0,0,0,0.45), 0 0 40px -8px ${theme.glow}`,
              } as React.CSSProperties)
            : undefined
        }
      >
        <div className="flex items-start gap-4 mb-4">
          <motion.img
            layoutId={`developer-avatar-${developer.login}`}
            src={developer.avatar_url}
            alt={developer.login}
            className="w-14 h-14 rounded-2xl ring-2 ring-white/10 object-cover shadow-lg"
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
              <span className="ml-auto flex items-center gap-0.5 text-[11px] font-medium shrink-0 text-sky-300">
                Profile
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 flex-wrap">
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
            <div
              className="text-2xl font-bold tabular-nums text-transparent bg-clip-text"
              style={{
                backgroundImage: `linear-gradient(90deg, ${theme.primary}, ${theme.secondary})`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
              }}
            >
              {developer.impactScore}
            </div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Impact</div>
          </div>
        </div>

        {developer.reposContributed.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {developer.reposContributed.map((repo) => (
              <span
                key={repo}
                className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10"
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
            <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
              <span>Avg Business Impact</span>
              <span className="text-white font-medium">{developer.avgBusinessImpact}/100</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden ring-1 ring-white/5">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${developer.avgBusinessImpact}%`,
                  background: `linear-gradient(90deg, ${theme.primary}, ${theme.secondary})`,
                }}
              />
            </div>
          </div>
        )}

        {developer.insights.length > 0 && (
          <div className="space-y-1 mt-3 pt-3 border-t border-white/10">
            {developer.insights.slice(0, 3).map((insight, i) => (
              <p key={i} className="text-xs text-gray-400 leading-relaxed">
                {insight}
              </p>
            ))}
          </div>
        )}
      </motion.div>
    </Link>
  );
}
