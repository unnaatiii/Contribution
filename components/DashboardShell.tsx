"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  RefreshCw,
  GitBranch,
  Clock,
  Users,
  GitCommit,
  FolderGit2,
  BarChart3,
  ListOrdered,
  Library,
  FlaskConical,
  X,
} from "lucide-react";
import { useAnalysisSession } from "@/components/AnalysisSessionProvider";
import CommitNotificationBell from "@/components/CommitNotificationBell";

const nav = [
  { href: "/repo", label: "Repo", icon: Library },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/commits", label: "Commits", icon: ListOrdered },
  { href: "/developers", label: "Developers", icon: Users },
  { href: "/analysis", label: "Analysis", icon: FlaskConical },
] as const;

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    result,
    dataResult,
    wideSnapshot,
    displayMode,
    returnToLiveView,
    clearSessionAndGoConnect,
    handleRefresh,
    error,
    dismissError,
    databasePersistenceEnabled,
  } = useAnalysisSession();

  if (!result) return null;

  const headerResult = dataResult ?? result;
  const repoLabels = headerResult.repos.map((r) => r.label).join(", ");
  const truncatedRepos =
    repoLabels.length > 120 ? `${repoLabels.slice(0, 117)}…` : repoLabels;

  return (
    <div className="min-h-screen">
      {displayMode === "restored" && wideSnapshot ? (
        <div className="sticky top-0 z-[55] px-4 py-2.5 bg-amber-950/90 border-b border-amber-500/35 text-sm text-amber-100 flex flex-wrap items-center justify-between gap-3">
          <span className="min-w-0">
            Viewing a <strong className="text-amber-50">saved analysis</strong> — leaderboard, charts,
            commits, and developer profiles match this run only (not the full org load).
          </span>
          <button
            type="button"
            onClick={() => returnToLiveView()}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-50 hover:bg-amber-500/30 text-xs font-medium cursor-pointer"
          >
            Return to live org view
          </button>
        </div>
      ) : null}
      {error ? (
        <div className="sticky top-0 z-[60] px-6 py-2 bg-red-950/90 border-b border-red-500/30 text-sm text-red-100 flex items-center justify-between gap-3">
          <span className="min-w-0">{error}</span>
          <button
            type="button"
            onClick={dismissError}
            className="shrink-0 p-1 rounded-lg hover:bg-white/10 text-red-200 cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : null}
      <header className="sticky top-0 z-50 border-b border-white/10 px-6 py-3 bg-slate-950/40 backdrop-blur-2xl">
        <div className="max-w-[1600px] mx-auto flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/25 to-blue-500/25 ring-1 ring-white/10 shrink-0">
              <Activity className="w-5 h-5 text-purple-300" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-white tracking-tight">DevImpact AI</h1>
              <div className="flex flex-col gap-0.5 text-xs text-gray-400">
                <span className="flex items-center gap-2">
                  <FolderGit2 className="w-3 h-3 shrink-0 text-purple-400/80" />
                  <span className="truncate" title={repoLabels}>
                    {wideSnapshot
                      ? `${wideSnapshot.result.repoCount} repos (org view)`
                      : truncatedRepos}
                  </span>
                </span>
                {headerResult.analysisWindow && (
                  <span className="pl-5 text-[10px] text-gray-500">
                    Data window: {headerResult.analysisWindow.from} → {headerResult.analysisWindow.to}
                  </span>
                )}
              </div>
            </div>
          </div>

          <nav
            className="magic-nav-container relative flex flex-nowrap items-stretch gap-2 w-full min-w-0 max-w-full lg:flex-1 lg:max-w-2xl lg:mx-auto overflow-x-auto pb-2 sm:pb-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Dashboard sections"
          >
            {nav.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  data-active={active ? "true" : undefined}
                  className={`magic-nav-link relative z-10 inline-flex flex-1 min-w-[5.25rem] sm:min-w-0 justify-center items-center gap-1.5 text-xs px-3 py-2 rounded-[14px] border transition-all duration-300 outline-offset-2 ${
                    active
                      ? "bg-purple-500/20 border-purple-400/35 text-white"
                      : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0 opacity-90" />
                  {label}
                </Link>
              );
            })}
            <span className="magic-nav-line" aria-hidden />
          </nav>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <CommitNotificationBell
              token={wideSnapshot?.config.token ?? null}
              enabled={databasePersistenceEnabled}
              onAnalysisVersionBump={handleRefresh}
            />
            <div className="hidden xl:flex items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-blue-400/80" />
                {headerResult.repoCount} repos
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-purple-400/80" />
                {headerResult.developers.length} devs
              </span>
              <span className="flex items-center gap-1.5">
                <GitCommit className="w-3.5 h-3.5" />
                {headerResult.commitCount} commits
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-200 ring-1 ring-purple-500/25">
                {headerResult.hasAiEnhancement
                  ? headerResult.modelsUsed.length > 0
                    ? `AI (${headerResult.modelsUsed.length} models)`
                    : "AI (cached)"
                  : "GitHub data"}
              </span>
              {headerResult.analysisAllowlist && headerResult.analysisAllowlist.length > 0 && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/25 max-w-[200px] truncate"
                  title={headerResult.analysisAllowlist.join(", ")}
                >
                  Team filter ({headerResult.analysisAllowlist.length})
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {new Date(headerResult.analyzedAt).toLocaleDateString()}
              </span>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              className="p-2.5 text-gray-400 hover:text-white rounded-[14px] bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300 cursor-pointer"
              title="Refresh all repos from GitHub (keeps AI cache)"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={clearSessionAndGoConnect}
              className="text-xs px-4 py-2 text-gray-300 rounded-[20px] border border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-300 cursor-pointer"
            >
              Change PAT
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
