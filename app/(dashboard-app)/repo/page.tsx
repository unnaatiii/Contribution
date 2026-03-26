"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { ChevronDown, ChevronRight, GitBranch } from "lucide-react";
import type { AnalyzedCommit, RepoConfig } from "@/lib/types";
import { useAnalysisSession } from "@/components/AnalysisSessionProvider";
import { formatCommitDateTime } from "@/lib/format-commit-date";

const PAGE_SIZE = 10;

function repoKey(r: RepoConfig): string {
  return `${r.owner}/${r.repo}`;
}

export default function RepoPage() {
  const { result, dataResult, wideSnapshot } = useAnalysisSession();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [pages, setPages] = useState<Record<string, number>>({});
  const [repoSyncAt, setRepoSyncAt] = useState<Record<string, string>>({});

  useEffect(() => {
    const fromSnap = wideSnapshot?.repoSyncAt;
    if (fromSnap && Object.keys(fromSnap).length > 0) {
      setRepoSyncAt(fromSnap);
      return;
    }
    const tok = wideSnapshot?.config.token?.trim();
    const repos = wideSnapshot?.config.repos ?? [];
    if (!tok || repos.length === 0) {
      setRepoSyncAt({});
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/data/repos-sync-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: tok, repos }),
        });
        const j = (await res.json()) as { syncAt?: Record<string, string>; enabled?: boolean };
        if (!cancelled && j.enabled && j.syncAt) setRepoSyncAt(j.syncAt);
      } catch {
        if (!cancelled) setRepoSyncAt({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wideSnapshot?.repoSyncAt, wideSnapshot?.config.token, wideSnapshot?.config.repos]);

  const view = dataResult ?? result;
  if (!view) return null;

  const commitsByRepo = useMemo(() => {
    const m = new Map<string, AnalyzedCommit[]>();
    for (const c of view.analyzedCommits) {
      if (c.isMergeCommit) continue;
      const k = c.repo;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return m;
  }, [view.analyzedCommits]);

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const setPage = useCallback((key: string, p: number) => {
    setPages((prev) => ({ ...prev, [key]: p }));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/15 ring-1 ring-white/10">
          <GitBranch className="w-5 h-5 text-cyan-300" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-white tracking-tight">Repositories</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Commits from your org snapshot (DB when synced, same window as dashboard). Expand a repo —
            10 per page.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {view.repos.map((r) => {
          const key = repoKey(r);
          const list = commitsByRepo.get(key) ?? [];
          const isOpen = expanded.has(key);
          const page = Math.max(1, pages[key] ?? 1);
          const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
          const safePage = Math.min(page, totalPages);
          const start = (safePage - 1) * PAGE_SIZE;
          const slice = list.slice(start, start + PAGE_SIZE);

          return (
            <div key={key} className="glass-surface overflow-hidden rounded-[16px] border border-white/10">
              <button
                type="button"
                onClick={() => toggle(key)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.04] transition-colors"
              >
                {isOpen ? (
                  <ChevronDown className="w-5 h-5 text-zinc-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{r.label}</p>
                  <p className="text-xs text-zinc-500 font-mono truncate">{key}</p>
                  {repoSyncAt[key] ? (
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      Last DB sync: {formatCommitDateTime(repoSyncAt[key])}
                    </p>
                  ) : null}
                </div>
                <span className="text-xs text-zinc-400 tabular-nums shrink-0">
                  {list.length} commit{list.length === 1 ? "" : "s"}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-white/10 px-4 py-3 bg-black/20">
                  {list.length === 0 ? (
                    <p className="text-sm text-zinc-500 py-4 text-center">No commits in this window.</p>
                  ) : (
                    <>
                      <ul className="space-y-2">
                        {slice.map((c) => (
                          <li
                            key={c.sha}
                            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm"
                          >
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                              <span className="text-[11px] text-zinc-400 tabular-nums">
                                {formatCommitDateTime(c.date)}
                              </span>
                              <span className="text-[11px] font-mono text-zinc-500">{c.sha.slice(0, 7)}</span>
                              <span className="text-[11px] text-purple-300/90">{c.author}</span>
                            </div>
                            <p className="text-zinc-100 font-mono text-xs mt-1 line-clamp-2">
                              {c.message.split("\n")[0]}
                            </p>
                          </li>
                        ))}
                      </ul>
                      {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-4">
                          <button
                            type="button"
                            disabled={safePage <= 1}
                            onClick={() => setPage(key, safePage - 1)}
                            className="text-xs px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 text-zinc-200 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          <span className="text-xs text-zinc-400 tabular-nums">
                            {safePage} / {totalPages}
                          </span>
                          <button
                            type="button"
                            disabled={safePage >= totalPages}
                            onClick={() => setPage(key, safePage + 1)}
                            className="text-xs px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 text-zinc-200 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
