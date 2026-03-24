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
} from "lucide-react";
import { useAnalysisSession } from "@/components/AnalysisSessionProvider";

const nav = [
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/commits", label: "Commits", icon: ListOrdered },
  { href: "/developers", label: "Developers", icon: Users },
] as const;

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { result, clearSessionAndGoConnect, handleRefresh } = useAnalysisSession();

  if (!result) return null;

  return (
    <div className="min-h-screen">
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
                  <span className="truncate">{result.repos.map((r) => r.label).join(", ")}</span>
                </span>
                {result.analysisWindow && (
                  <span className="pl-5 text-[10px] text-gray-500">
                    Data: {result.analysisWindow.from} → {result.analysisWindow.to}
                  </span>
                )}
              </div>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-1.5 sm:gap-2" aria-label="Dashboard sections">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-[14px] border transition-all duration-300 ${
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
          </nav>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="hidden xl:flex items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-blue-400/80" />
                {result.repoCount} repos
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-purple-400/80" />
                {result.developers.length} devs
              </span>
              <span className="flex items-center gap-1.5">
                <GitCommit className="w-3.5 h-3.5" />
                {result.commitCount} commits
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-200 ring-1 ring-purple-500/25">
                {result.aiPowered ? `AI (${result.modelsUsed.length} models)` : "Heuristic"}
              </span>
              {result.analysisAllowlist && result.analysisAllowlist.length > 0 && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/25 max-w-[200px] truncate"
                  title={result.analysisAllowlist.join(", ")}
                >
                  Team filter ({result.analysisAllowlist.length})
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {new Date(result.analyzedAt).toLocaleDateString()}
              </span>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              className="p-2.5 text-gray-400 hover:text-white rounded-[14px] bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300 cursor-pointer"
              title="Re-run analysis"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={clearSessionAndGoConnect}
              className="text-xs px-4 py-2 text-gray-300 rounded-[20px] border border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-300 cursor-pointer"
            >
              Change Repos
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
