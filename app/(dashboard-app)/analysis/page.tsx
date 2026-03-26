"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarRange,
  CheckSquare,
  History,
  Loader2,
  Sparkles,
  Square,
} from "lucide-react";
import { useAnalysisSession } from "@/components/AnalysisSessionProvider";
import type { ConnectAnalysisConfig } from "@/app/components/ConnectForm";
import type { RepoConfig } from "@/lib/types";
import { defaultAnalysisDateRange, toYMD, validateAnalysisDateRange } from "@/lib/date-range";
import { commitTableStats } from "@/lib/analyzed-commit-stats";

function fullName(r: RepoConfig): string {
  return `${r.owner}/${r.repo}`;
}

export default function AnalysisPage() {
  const router = useRouter();
  const {
    wideSnapshot,
    runScopedAiAnalysis,
    analysisHistory,
    phase,
    progress,
    applyAnalysisHistoryRun,
    historyRunHasSnapshot,
    analysisSnapshots,
  } = useAnalysisSession();
  const defaultRange = useMemo(() => defaultAnalysisDateRange(), []);
  const [dateFrom, setDateFrom] = useState(defaultRange.dateFrom);
  const [dateTo, setDateTo] = useState(defaultRange.dateTo);
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [localError, setLocalError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const allRepos = wideSnapshot?.config.repos ?? [];
  const token = wideSnapshot?.config.token ?? "";

  const selectedSet = useMemo(() => {
    if (selected !== null) return selected;
    return new Set(allRepos.map(fullName));
  }, [selected, allRepos]);

  const toggleRepo = useCallback((fn: string) => {
    setSelected((prev) => {
      const base = prev ?? new Set(allRepos.map(fullName));
      const next = new Set(base);
      if (next.has(fn)) next.delete(fn);
      else next.add(fn);
      return next;
    });
  }, [allRepos]);

  const selectAll = useCallback(() => {
    setSelected(new Set(allRepos.map(fullName)));
  }, [allRepos]);

  const selectNone = useCallback(() => {
    setSelected(new Set());
  }, []);

  const applyPresetDays = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - days);
    setDateFrom(toYMD(from));
    setDateTo(toYMD(to));
  };

  const todayYmd = useMemo(() => toYMD(new Date()), []);

  const handleRun = async () => {
    setLocalError("");
    if (!wideSnapshot) {
      setLocalError("No org data. Sign in again from the home page.");
      return;
    }
    if (!token) {
      setLocalError("Missing token. Sign in again.");
      return;
    }
    const rangeCheck = validateAnalysisDateRange(dateFrom, dateTo);
    if (!rangeCheck.ok) {
      setLocalError(rangeCheck.error);
      return;
    }
    const picked = allRepos.filter((r) => selectedSet.has(fullName(r)));
    if (picked.length === 0) {
      setLocalError("Select at least one repository.");
      return;
    }

    const cfg: ConnectAnalysisConfig = {
      token,
      repos: picked,
      dateFrom,
      dateTo,
    };

    setSubmitting(true);
    try {
      await runScopedAiAnalysis(cfg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!wideSnapshot) {
    return (
      <div className="glass-surface p-8 text-center text-zinc-400">
        <p className="mb-4">No repository snapshot loaded.</p>
        <Link href="/" className="text-purple-400 hover:text-blue-300 underline text-sm">
          Connect with GitHub
        </Link>
      </div>
    );
  }

  const busy = submitting || phase === "analyzing_ai";
  const analyzing = phase === "analyzing_ai";

  const onHistoryClick = async (historyId: string) => {
    const ok = await applyAnalysisHistoryRun(historyId);
    if (!ok) {
      setLocalError("Saved results for this run are not available. Run a new analysis to capture them.");
      return;
    }
    router.push("/insights");
  };

  return (
    <div className="relative max-w-7xl mx-auto">
      <div className="lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start">
        <div className="lg:col-span-7 space-y-8 min-w-0">
          {analyzing && (
            <div
              className="glass-surface p-6 rounded-[20px] border border-purple-500/35 bg-slate-950/80 shadow-lg shadow-purple-900/20 animate-fade-rise"
              role="status"
              aria-live="polite"
            >
              <div className="analyzing-loader mx-auto mb-4 max-w-[200px]" aria-hidden />
              <h2 className="text-xl font-semibold text-white text-center mb-2">AI analysis in progress</h2>
              <p className="text-sm text-zinc-400 text-center leading-relaxed">{progress}</p>
              <div className="mt-4 h-1.5 rounded-full bg-white/5 overflow-hidden shimmer-bar mx-auto max-w-xs" />
              <p className="text-xs text-zinc-500 text-center mt-4 leading-relaxed">
                This column is paused until the run finishes. You can still open{" "}
                <Link href="/insights" className="text-purple-400 hover:text-blue-300 underline">
                  Insights
                </Link>
                ,{" "}
                <Link href="/repo" className="text-purple-400 hover:text-blue-300 underline">
                  Repo
                </Link>
                , or other tabs.
              </p>
            </div>
          )}

          <div>
            <h2 className="text-2xl font-semibold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-7 h-7 text-purple-400" />
              AI analysis
            </h2>
            <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
              Choose repositories and a date range. We fetch commits with diffs, run the model only on SHAs
              not already in your cache, then refresh the{" "}
              <Link href="/insights" className="text-purple-400 hover:text-blue-300 underline">
                Insights
              </Link>{" "}
              leaderboard. Past runs are on the right — click one to reopen that snapshot in Insights.
            </p>
          </div>

          <div
            className={`space-y-8 ${analyzing ? "pointer-events-none opacity-[0.38] select-none" : ""}`}
            aria-hidden={analyzing}
          >
      <div className="glass-surface p-5 space-y-4 rounded-[16px]">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm font-medium text-white">Repositories</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={selectNone}
              className="text-xs px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="max-h-[280px] overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5">
          {allRepos.map((r) => {
            const fn = fullName(r);
            const on = selectedSet.has(fn);
            return (
              <label
                key={fn}
                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-white/[0.04] ${on ? "bg-violet-500/10" : ""}`}
              >
                <span className="text-zinc-400">
                  {on ? <CheckSquare className="w-5 h-5 text-violet-300" /> : <Square className="w-5 h-5" />}
                </span>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={() => toggleRepo(fn)}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-100 font-mono truncate">{fn}</p>
                  <p className="text-xs text-zinc-500 truncate">{r.label}</p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div className="glass-surface p-5 space-y-4 rounded-[16px]">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <CalendarRange className="w-4 h-4 text-sky-400" />
          Analysis period
        </div>
        <div className="flex flex-wrap gap-2">
          {([7, 14, 30, 90] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => applyPresetDays(d)}
              className="text-xs px-2.5 py-1.5 rounded-xl border border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10"
            >
              Last {d}d
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm bg-black/40 border border-white/15 text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              max={todayYmd}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm bg-black/40 border border-white/15 text-white"
            />
          </div>
        </div>
      </div>

      {localError && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">
          {localError}
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => void handleRun()}
        className="w-full py-3.5 px-6 rounded-[20px] font-medium btn-gradient-saas flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Running analysis…
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Run AI analysis
          </>
        )}
      </button>

          </div>
        </div>

        <aside className="lg:col-span-5 mt-10 lg:mt-0 min-w-0">
          <div className="lg:sticky lg:top-24 space-y-3">
            <div className="glass-surface p-5 rounded-[16px] border border-white/10">
              <div className="flex items-center gap-2 text-sm font-semibold text-white mb-1">
                <History className="w-4 h-4 text-purple-400 shrink-0" />
                Previously analyzed
              </div>
              <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                Click a run to open <span className="text-zinc-400">Insights</span> in{" "}
                <span className="text-zinc-400">saved-run mode</span>: leaderboard, charts, Commits, and
                developer profiles all use that run&apos;s stored results until you return to the live org
                view or run new analysis. New runs only — older sessions have no saved snapshot.
              </p>
              {analysisHistory.length === 0 ? (
                <p className="text-xs text-zinc-500">No runs yet. Run analysis once to build this list.</p>
              ) : (
                <ul className="space-y-2 max-h-[min(70vh,520px)] overflow-y-auto pr-1 -mr-1">
                  {analysisHistory.map((h) => {
                    const hid = h.id ?? `legacy-${h.runAt}`;
                    const canOpen = historyRunHasSnapshot(hid);
                    const snap = analysisSnapshots[hid];
                    const rawStats =
                      h.commitsAnalyzed != null && h.commitsInWindow != null
                        ? { analyzed: h.commitsAnalyzed, window: h.commitsInWindow }
                        : snap
                          ? commitTableStats(snap.analyzedCommits)
                          : null;
                    const stats = rawStats
                      ? {
                          analyzed: "analyzed" in rawStats ? rawStats.analyzed : rawStats.analyzedWithAi,
                          window: "window" in rawStats ? rawStats.window : rawStats.nonMergeInView,
                        }
                      : null;
                    return (
                      <li key={hid}>
                        <button
                          type="button"
                          disabled={!canOpen}
                          title={
                            canOpen
                              ? "Open Insights for this run"
                              : "No snapshot (run analysis again after updating the app)"
                          }
                          onClick={() => onHistoryClick(hid)}
                          className="w-full text-left rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 transition-colors hover:border-purple-500/35 hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-white/10 disabled:hover:bg-white/[0.03]"
                        >
                          <span className="text-[11px] text-zinc-500 block">
                            {new Date(h.runAt).toLocaleString()}
                          </span>
                          <span className="text-xs text-zinc-300 mt-1 block line-clamp-2">
                            {h.repos.join(", ")}
                          </span>
                          <span className="text-[11px] text-sky-400/90 mt-1 block font-mono">
                            {h.dateRange.from} → {h.dateRange.to}
                          </span>
                          {stats && (
                            <span className="text-[11px] text-zinc-400 mt-1 block">
                              <span className="text-emerald-400/90 font-medium tabular-nums">
                                {stats.analyzed}
                              </span>{" "}
                              analyzed
                              {stats.window !== stats.analyzed && (
                                <>
                                  {" "}
                                  ·{" "}
                                  <span className="tabular-nums text-zinc-500">{stats.window}</span> non-merge
                                  in run
                                </>
                              )}
                            </span>
                          )}
                          {canOpen ? (
                            <span className="text-[10px] text-purple-400/90 mt-1.5 inline-block">
                              Open in Insights →
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-600 mt-1.5 block">No snapshot</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
