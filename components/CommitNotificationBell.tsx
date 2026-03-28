"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { backendApiUrl } from "@/lib/backend-url";

type CommitRow = {
  repo: string;
  sha: string;
  author: string | null;
  message: string | null;
  date: string | null;
  ingested_at: string;
};

const POLL_MS = 22_000;
const SS_SINCE = "devimpact_commit_notif_since";
const SS_AI_VER = "devimpact_ai_batch_version";

type DisplayLine =
  | {
      key: string;
      consolidated: true;
      author: string;
      repoCount: number;
      repoList: string[];
      sha: string;
    }
  | {
      key: string;
      consolidated: false;
      author: string;
      repo: string;
      sha: string;
      messageLine: string;
    };

function buildDisplayLines(commits: CommitRow[]): DisplayLine[] {
  const byAuthor = new Map<string, CommitRow[]>();
  for (const c of commits) {
    const a = (c.author ?? "unknown").trim() || "unknown";
    const list = byAuthor.get(a) ?? [];
    list.push(c);
    byAuthor.set(a, list);
  }

  const lines: DisplayLine[] = [];
  for (const [author, list] of byAuthor) {
    const sorted = [...list].sort(
      (x, y) => new Date(x.ingested_at).getTime() - new Date(y.ingested_at).getTime(),
    );
    const repos = [...new Set(sorted.map((c) => c.repo))].sort();
    const last = sorted[sorted.length - 1];
    if (repos.length > 2) {
      lines.push({
        key: `c:${author}`,
        consolidated: true,
        author,
        repoCount: repos.length,
        repoList: repos,
        sha: last.sha,
      });
    } else {
      for (const repo of repos) {
        const inRepo = sorted.filter((c) => c.repo === repo);
        const tip = inRepo[inRepo.length - 1];
        const msg = (tip.message ?? "").split("\n")[0].slice(0, 72);
        lines.push({
          key: `${author}:${repo}`,
          consolidated: false,
          author,
          repo,
          sha: tip.sha,
          messageLine: msg,
        });
      }
    }
  }
  return lines.sort((a, b) => a.author.localeCompare(b.author));
}

export default function CommitNotificationBell({
  token,
  enabled,
  onAnalysisVersionBump,
}: {
  token: string | null;
  enabled: boolean;
  onAnalysisVersionBump: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [bySha, setBySha] = useState<Record<string, CommitRow>>({});
  const lastHandledAiVer = useRef<number | null>(null);

  const mergeCommits = useCallback((incoming: CommitRow[]) => {
    if (incoming.length === 0) return;
    setBySha((prev) => {
      const next = { ...prev };
      for (const c of incoming) {
        next[c.sha] = c;
      }
      return next;
    });
  }, []);

  const poll = useCallback(async () => {
    if (!enabled || !token?.trim()) return;
    try {
      if (typeof window !== "undefined" && !sessionStorage.getItem(SS_SINCE)) {
        sessionStorage.setItem(SS_SINCE, new Date().toISOString());
      }
      const sinceIso =
        typeof window !== "undefined" ? sessionStorage.getItem(SS_SINCE) ?? new Date(0).toISOString() : new Date(0).toISOString();

      let lastKnown = -1;
      if (typeof window !== "undefined") {
        const raw = sessionStorage.getItem(SS_AI_VER);
        if (raw !== null && raw !== "") {
          const n = parseInt(raw, 10);
          if (Number.isFinite(n)) lastKnown = n;
        }
      }

      const res = await fetch(backendApiUrl("/api/commits/notifications"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, sinceIso, lastKnownAiBatchVersion: lastKnown }),
      });
      const data = (await res.json()) as {
        enabled?: boolean;
        commits?: CommitRow[];
        aiBatchVersion?: number;
        analysisVersionBumped?: boolean;
      };

      if (!data.enabled || !Array.isArray(data.commits)) return;

      mergeCommits(data.commits);

      if (data.commits.length > 0) {
        let maxT = sinceIso;
        for (const c of data.commits) {
          if (c.ingested_at > maxT) maxT = c.ingested_at;
        }
        if (typeof window !== "undefined") sessionStorage.setItem(SS_SINCE, maxT);
      }

      const ver = typeof data.aiBatchVersion === "number" ? data.aiBatchVersion : 0;
      if (typeof window !== "undefined") {
        sessionStorage.setItem(SS_AI_VER, String(ver));
      }

      if (data.analysisVersionBumped && lastKnown >= 0) {
        if (lastHandledAiVer.current !== ver) {
          lastHandledAiVer.current = ver;
          onAnalysisVersionBump();
        }
      } else if (lastKnown < 0) {
        lastHandledAiVer.current = ver;
      }
    } catch {
      /* ignore */
    }
  }, [enabled, token, mergeCommits, onAnalysisVersionBump]);

  useEffect(() => {
    if (!enabled || !token) return;
    const t = window.setTimeout(() => void poll(), 0);
    const id = setInterval(() => void poll(), POLL_MS);
    const vis = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.clearTimeout(t);
      clearInterval(id);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [enabled, token, poll]);

  const list = useMemo(() => Object.values(bySha), [bySha]);
  const lines = useMemo(() => buildDisplayLines(list), [list]);
  const count = list.length;

  if (!enabled || !token) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative p-2.5 text-gray-400 hover:text-white rounded-[14px] bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300 cursor-pointer"
        title="New commits (org webhook)"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="w-4 h-4" />
        {count > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-semibold rounded-full bg-purple-500 text-white ring-2 ring-slate-950">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[55] cursor-default bg-transparent"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 z-[60] w-[min(100vw-2rem,22rem)] rounded-[16px] border border-white/10 bg-slate-950/95 backdrop-blur-xl shadow-xl py-2 max-h-[min(70vh,420px)] overflow-y-auto">
            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-white">New commits</span>
              {count > 0 ? (
                <button
                  type="button"
                  className="text-[10px] text-purple-300 hover:text-white cursor-pointer"
                  onClick={() => setBySha({})}
                >
                  Clear
                </button>
              ) : null}
            </div>
            {lines.length === 0 ? (
              <p className="px-3 py-6 text-xs text-zinc-500 text-center">No new commits since this session.</p>
            ) : (
              <ul className="py-1">
                {lines.map((line) => (
                  <li key={line.key} className="border-b border-white/5 last:border-0">
                    <Link
                      href={`/commits?sha=${encodeURIComponent(line.sha)}`}
                      onClick={() => setOpen(false)}
                      className="block px-3 py-2.5 hover:bg-white/[0.06] transition-colors"
                    >
                      {line.consolidated ? (
                        <p className="text-xs text-zinc-200">
                          <span className="font-medium text-white">{line.author}</span>
                          <span className="text-zinc-500"> — pushed to </span>
                          <span className="text-purple-200">{line.repoCount} repositories</span>
                        </p>
                      ) : (
                        <>
                          <p className="text-xs text-zinc-200">
                            <span className="font-medium text-white">{line.author}</span>
                            <span className="text-zinc-500"> — </span>
                            <span className="text-zinc-400 font-mono text-[11px]">{line.repo}</span>
                          </p>
                          {line.messageLine ? (
                            <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">{line.messageLine}</p>
                          ) : null}
                        </>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
