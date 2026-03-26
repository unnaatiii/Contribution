"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { AnalysisCache, AnalysisHistoryEntry, AnalysisResult } from "@/lib/types";
import type { ConnectAnalysisConfig } from "@/app/components/ConnectForm";
import { defaultAnalysisDateRange } from "@/lib/date-range";
import {
  buildCacheFromAnalyzedCommits,
  cacheCommitCount,
  emptyAnalysisCache,
  mergeAnalysisCachePreferDatabase,
} from "@/lib/analysis-cache";
import { clearActiveContributorsCache } from "@/lib/active-contributors-cache";
import {
  SESSION_AI_CACHE_KEY,
  SESSION_ANALYSIS_HISTORY_KEY,
  SESSION_ANALYSIS_SNAPSHOTS_KEY,
  SESSION_CONFIG_KEY,
  SESSION_RESULT_KEY,
  SESSION_WIDE_BASE_KEY,
  SESSION_DISPLAY_MODE_KEY,
} from "@/lib/session-keys";
import { mergeWideAndScopedAi } from "@/lib/merge-analysis-result";
import { commitTableStats } from "@/lib/analyzed-commit-stats";

export type SessionDisplayMode = "live" | "restored";

export type Phase = "connect" | "loading_data" | "analyzing_ai" | "done" | "error";

export type WideBaseSnapshot = {
  config: ConnectAnalysisConfig;
  result: AnalysisResult;
  /** `owner/repo` → ISO timestamp of last successful DB sync for that repo. */
  repoSyncAt?: Record<string, string>;
  /** Wide commit list came from DB read vs live GitHub merge (informational). */
  commitsDataSource?: "github" | "database";
  /** When `/api/load-base` last completed successfully — enables short client TTL reuse without refetch. */
  baseLoadedAt?: string;
};

// Re-export session keys for any legacy imports
export {
  SESSION_RESULT_KEY,
  SESSION_CONFIG_KEY,
  SESSION_AI_CACHE_KEY,
  SESSION_ANALYSIS_HISTORY_KEY,
  SESSION_WIDE_BASE_KEY,
};

function normalizeStoredConfig(raw: unknown): ConnectAnalysisConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.token !== "string" || !Array.isArray(o.repos)) return null;
  const fallback = defaultAnalysisDateRange();
  const dateFrom = typeof o.dateFrom === "string" ? o.dateFrom : fallback.dateFrom;
  const dateTo = typeof o.dateTo === "string" ? o.dateTo : fallback.dateTo;
  const allowedLogins = Array.isArray(o.allowedLogins)
    ? (o.allowedLogins as string[]).filter((x) => typeof x === "string")
    : undefined;
  return {
    token: o.token,
    repos: o.repos as ConnectAnalysisConfig["repos"],
    dateFrom,
    dateTo,
    ...(allowedLogins?.length ? { allowedLogins } : {}),
  };
}

function normalizeAnalysisResult(data: AnalysisResult): AnalysisResult {
  if (data.hasAiEnhancement === undefined) {
    data.hasAiEnhancement = data.analyzedCommits.some(
      (c) => c.analysis && !c.isMergeCommit,
    );
  }
  if (!data.dataLayer) {
    data.dataLayer = data.hasAiEnhancement ? "enhanced" : "base";
  }
  return data;
}

function parseAnalysisCache(raw: string | null): AnalysisCache {
  if (!raw) return emptyAnalysisCache();
  try {
    const c = JSON.parse(raw) as AnalysisCache;
    if (c?.version === 1 && c.repos && typeof c.repos === "object") return c;
  } catch {
    /* ignore */
  }
  return emptyAnalysisCache();
}

function parseHistory(raw: string | null): AnalysisHistoryEntry[] {
  if (!raw) return [];
  try {
    const a = JSON.parse(raw) as unknown;
    if (!Array.isArray(a)) return [];
    return a.filter(
      (x) =>
        x &&
        typeof x === "object" &&
        Array.isArray((x as AnalysisHistoryEntry).repos) &&
        (x as AnalysisHistoryEntry).dateRange,
    ) as AnalysisHistoryEntry[];
  } catch {
    return [];
  }
}

function normalizeHistoryEntries(entries: AnalysisHistoryEntry[]): AnalysisHistoryEntry[] {
  return entries.map((e) => ({
    ...e,
    id: e.id ?? `legacy-${e.runAt}`,
  }));
}

function parseAnalysisSnapshots(raw: string | null): Record<string, AnalysisResult> {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as Record<string, AnalysisResult>;
    if (!o || typeof o !== "object") return {};
    return o;
  } catch {
    return {};
  }
}

function persistAnalysisSnapshots(store: Record<string, AnalysisResult>) {
  try {
    sessionStorage.setItem(SESSION_ANALYSIS_SNAPSHOTS_KEY, JSON.stringify(store));
  } catch {
    /* quota */
  }
}

function pruneAnalysisSnapshots(
  store: Record<string, AnalysisResult>,
  history: AnalysisHistoryEntry[],
): Record<string, AnalysisResult> {
  const allowed = new Set(history.map((h) => h.id).filter((x): x is string => Boolean(x)));
  return Object.fromEntries(Object.entries(store).filter(([k]) => allowed.has(k)));
}

function parseWideSnapshot(raw: string | null): WideBaseSnapshot | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as {
      config?: unknown;
      result?: unknown;
      repoSyncAt?: Record<string, string>;
      commitsDataSource?: "github" | "database";
      baseLoadedAt?: string;
    };
    const cfg = normalizeStoredConfig(o.config);
    const res = o.result as AnalysisResult | undefined;
    if (!cfg || !res || !Array.isArray(res.developers)) return null;
    return {
      config: cfg,
      result: normalizeAnalysisResult(res),
      ...(o.repoSyncAt && typeof o.repoSyncAt === "object" ? { repoSyncAt: o.repoSyncAt } : {}),
      ...(o.commitsDataSource === "database" || o.commitsDataSource === "github"
        ? { commitsDataSource: o.commitsDataSource }
        : {}),
      ...(typeof o.baseLoadedAt === "string" && o.baseLoadedAt ? { baseLoadedAt: o.baseLoadedAt } : {}),
    };
  } catch {
    return null;
  }
}

/** Same wide dashboard input (token, repos, dates, allowlist) — order-insensitive for repos. */
function wideConfigsEqual(a: ConnectAnalysisConfig, b: ConnectAnalysisConfig): boolean {
  if (a.token !== b.token) return false;
  if (a.dateFrom !== b.dateFrom || a.dateTo !== b.dateTo) return false;
  const al = [...(a.allowedLogins ?? [])].sort().join("\0");
  const bl = [...(b.allowedLogins ?? [])].sort().join("\0");
  if (al !== bl) return false;
  const repoKey = (r: ConnectAnalysisConfig["repos"][number]) => `${r.owner}/${r.repo}`;
  const ak = [...a.repos].map(repoKey).sort().join("\0");
  const bk = [...b.repos].map(repoKey).sort().join("\0");
  return ak === bk;
}

/** Reuse last load-base response in-session without hitting the API (refresh always bypasses). */
const LOAD_BASE_CLIENT_CACHE_MS = 5 * 60 * 1000;

type ApiSuccessBody = AnalysisResult & {
  success?: boolean;
  analysisCache?: AnalysisCache;
  databasePersistence?: boolean;
  analysisRunId?: string;
  repoSyncAt?: Record<string, string>;
  commitsDataSource?: "github" | "database";
};

function persistSession(
  cfg: ConnectAnalysisConfig,
  result: AnalysisResult,
  cache: AnalysisCache,
  history: AnalysisHistoryEntry[],
) {
  try {
    sessionStorage.setItem(SESSION_RESULT_KEY, JSON.stringify(result));
    sessionStorage.setItem(SESSION_CONFIG_KEY, JSON.stringify(cfg));
    sessionStorage.setItem(SESSION_AI_CACHE_KEY, JSON.stringify(cache));
    sessionStorage.setItem(SESSION_ANALYSIS_HISTORY_KEY, JSON.stringify(history));
  } catch {
    /* quota */
  }
}

function persistWideSnapshot(snap: WideBaseSnapshot) {
  try {
    sessionStorage.setItem(SESSION_WIDE_BASE_KEY, JSON.stringify(snap));
  } catch {
    /* quota */
  }
}

function readDisplayMode(): SessionDisplayMode {
  if (typeof window === "undefined") return "live";
  try {
    const v = sessionStorage.getItem(SESSION_DISPLAY_MODE_KEY);
    return v === "restored" ? "restored" : "live";
  } catch {
    return "live";
  }
}

function persistDisplayMode(mode: SessionDisplayMode) {
  try {
    sessionStorage.setItem(SESSION_DISPLAY_MODE_KEY, mode);
  } catch {
    /* quota */
  }
}

type AnalysisSessionValue = {
  bootstrapped: boolean;
  phase: Phase;
  config: ConnectAnalysisConfig | null;
  /** Insights / leaderboard — last scoped AI view or same as wide until analysis runs */
  result: AnalysisResult | null;
  /** Commits, developers, Repo page — full org snapshot after PAT (stable across scoped AI) */
  dataResult: AnalysisResult | null;
  wideSnapshot: WideBaseSnapshot | null;
  analysisCache: AnalysisCache;
  analysisHistory: AnalysisHistoryEntry[];
  error: string;
  errorSource: "base" | "ai" | null;
  progress: string;
  selectedDev: string | null;
  setSelectedDev: (v: string | null) => void;
  hoveredProfile: string | null;
  setHoveredProfile: (v: string | null) => void;
  loadBaseData: (
    cfg: ConnectAnalysisConfig,
    opts?: { refresh?: boolean },
  ) => Promise<void>;
  /** AI for chosen repos + dates (Analysis page) */
  runScopedAiAnalysis: (cfg: ConnectAnalysisConfig) => Promise<void>;
  /** Restore Insights from a saved analysis run; returns false if no snapshot exists. */
  applyAnalysisHistoryRun: (historyId: string) => Promise<boolean>;
  historyRunHasSnapshot: (historyId: string) => boolean;
  /** Scoped AI run snapshots keyed by `AnalysisHistoryEntry.id` (sessionStorage). */
  analysisSnapshots: Record<string, AnalysisResult>;
  /** `restored` = UI shows a saved run only (no merge with full org list). */
  displayMode: SessionDisplayMode;
  /** Exit history view and use the org-wide snapshot again (Insights/Commits/Developers). */
  returnToLiveView: () => void;
  clearSessionAndGoConnect: () => void;
  handleRefresh: () => void;
  retryLastOperation: () => void;
  dismissError: () => void;
  /** Supabase persistence (USER_ID_PEPPER + service role) — enables webhook commit polls. */
  databasePersistenceEnabled: boolean;
};

const AnalysisSessionContext = createContext<AnalysisSessionValue | null>(null);

export function useAnalysisSession(): AnalysisSessionValue {
  const ctx = useContext(AnalysisSessionContext);
  if (!ctx) {
    throw new Error("useAnalysisSession must be used within AnalysisSessionProvider");
  }
  return ctx;
}

export function AnalysisSessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [bootstrapped, setBootstrapped] = useState(false);
  const [phase, setPhase] = useState<Phase>("connect");
  const [config, setConfig] = useState<ConnectAnalysisConfig | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [wideSnapshot, setWideSnapshot] = useState<WideBaseSnapshot | null>(null);
  const [analysisCache, setAnalysisCache] = useState<AnalysisCache>(emptyAnalysisCache());
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistoryEntry[]>([]);
  const [analysisSnapshots, setAnalysisSnapshots] = useState<Record<string, AnalysisResult>>({});
  const [error, setError] = useState("");
  const [errorSource, setErrorSource] = useState<"base" | "ai" | null>(null);
  const [progress, setProgress] = useState("");
  const [selectedDev, setSelectedDev] = useState<string | null>(null);
  const [hoveredProfile, setHoveredProfile] = useState<string | null>(null);
  const [lastAiConfig, setLastAiConfig] = useState<ConnectAnalysisConfig | null>(null);
  const [databasePersistenceEnabled, setDatabasePersistenceEnabled] = useState(false);
  const [displayMode, setDisplayMode] = useState<SessionDisplayMode>("live");

  /** Wide org commit list + scoped AI overlay, or a pure restored snapshot (no merge). */
  const dataResult = useMemo(() => {
    if (displayMode === "restored" && result) {
      return result;
    }
    const wide = wideSnapshot?.result;
    const scoped = result;
    if (!wide) return scoped ?? null;
    if (!scoped?.hasAiEnhancement) return wide;
    return mergeWideAndScopedAi(wide, scoped);
  }, [displayMode, wideSnapshot, result]);

  const returnToLiveView = useCallback(() => {
    if (!wideSnapshot) return;
    setDisplayMode("live");
    persistDisplayMode("live");
    const liveResult = wideSnapshot.result;
    setResult(liveResult);
    const cfg = wideSnapshot.config;
    setConfig(cfg);
    persistSession(cfg, liveResult, analysisCache, analysisHistory);
    if (liveResult.developers?.length) {
      setSelectedDev(liveResult.developers[0].login);
    }
  }, [wideSnapshot, analysisCache, analysisHistory]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let dbEnabled = false;
      try {
        const r = await fetch("/api/analysis/settings");
        const j = (await r.json()) as { databasePersistenceEnabled?: boolean };
        dbEnabled = !!j.databasePersistenceEnabled;
      } catch {
        /* ignore */
      }
      if (!cancelled) setDatabasePersistenceEnabled(dbEnabled);

      try {
        const cfgRaw = sessionStorage.getItem(SESSION_CONFIG_KEY);
        const parsedCfg = cfgRaw ? normalizeStoredConfig(JSON.parse(cfgRaw)) : null;

        let wide = parseWideSnapshot(sessionStorage.getItem(SESSION_WIDE_BASE_KEY));
        const resRaw = sessionStorage.getItem(SESSION_RESULT_KEY);
        let parsedResult: AnalysisResult | null = null;
        if (resRaw) {
          try {
            const data = JSON.parse(resRaw) as AnalysisResult;
            if (Array.isArray(data.developers)) {
              parsedResult = normalizeAnalysisResult(data);
            }
          } catch {
            /* ignore */
          }
        }

        if (!wide && parsedResult && parsedCfg) {
          wide = { config: parsedCfg, result: parsedResult };
          persistWideSnapshot(wide);
        }

        if (wide) {
          setWideSnapshot(wide);
        }

        if (parsedResult) {
          setResult(parsedResult);
          setPhase("done");
        } else if (wide) {
          setResult(wide.result);
          setPhase("done");
        }

        if (parsedCfg) {
          setConfig(parsedCfg);
        } else if (wide) {
          setConfig(wide.config);
        }

        let nextCache = parseAnalysisCache(sessionStorage.getItem(SESSION_AI_CACHE_KEY));
        const commitsSource = parsedResult ?? wide?.result;

        if (dbEnabled && parsedCfg?.token && parsedCfg.repos?.length) {
          try {
            const cacheRes = await fetch("/api/analysis/ai-cache", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: parsedCfg.token, repos: parsedCfg.repos }),
            });
            if (cacheRes.ok) {
              const cj = (await cacheRes.json()) as {
                analysisCache?: AnalysisCache;
                enabled?: boolean;
              };
              if (cj.enabled && cj.analysisCache) {
                nextCache = mergeAnalysisCachePreferDatabase(cj.analysisCache, nextCache);
                try {
                  sessionStorage.setItem(SESSION_AI_CACHE_KEY, JSON.stringify(nextCache));
                } catch {
                  /* quota */
                }
              }
            }
          } catch {
            /* ignore */
          }
        }

        if (cacheCommitCount(nextCache) === 0 && commitsSource?.analyzedCommits) {
          const rebuilt = buildCacheFromAnalyzedCommits(commitsSource.analyzedCommits);
          if (cacheCommitCount(rebuilt) > 0) {
            nextCache = mergeAnalysisCachePreferDatabase(rebuilt, nextCache);
            try {
              sessionStorage.setItem(SESSION_AI_CACHE_KEY, JSON.stringify(nextCache));
            } catch {
              /* ignore */
            }
          }
        }
        if (!cancelled) setAnalysisCache(nextCache);

        const histRaw = parseHistory(sessionStorage.getItem(SESSION_ANALYSIS_HISTORY_KEY));
        let histNorm = normalizeHistoryEntries(histRaw);
        if (histRaw.some((e, i) => e.id !== histNorm[i]?.id)) {
          try {
            sessionStorage.setItem(SESSION_ANALYSIS_HISTORY_KEY, JSON.stringify(histNorm));
          } catch {
            /* ignore */
          }
        }
        if (dbEnabled && parsedCfg?.token) {
          try {
            const runsRes = await fetch("/api/analysis/runs/list", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: parsedCfg.token }),
            });
            if (runsRes.ok) {
              const rj = (await runsRes.json()) as {
                runs?: AnalysisHistoryEntry[];
                enabled?: boolean;
              };
              if (rj.enabled && Array.isArray(rj.runs) && rj.runs.length > 0) {
                const dbHist = normalizeHistoryEntries(rj.runs);
                const seen = new Set(dbHist.map((h) => h.id).filter(Boolean) as string[]);
                histNorm = [...dbHist, ...histNorm.filter((h) => h.id && !seen.has(h.id))].slice(
                  0,
                  24,
                );
              }
            }
          } catch {
            /* ignore */
          }
        }
        if (!cancelled) {
          setAnalysisHistory(histNorm);
          setAnalysisSnapshots(parseAnalysisSnapshots(sessionStorage.getItem(SESSION_ANALYSIS_SNAPSHOTS_KEY)));
        }

        const devs = (parsedResult ?? wide?.result)?.developers;
        if (devs && devs.length > 0) {
          setSelectedDev((prev) => prev ?? devs[0].login);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) {
          setDisplayMode(readDisplayMode());
          setBootstrapped(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const clearSessionAndGoConnect = useCallback(() => {
    try {
      sessionStorage.removeItem(SESSION_RESULT_KEY);
      sessionStorage.removeItem(SESSION_CONFIG_KEY);
      sessionStorage.removeItem(SESSION_AI_CACHE_KEY);
      sessionStorage.removeItem(SESSION_ANALYSIS_HISTORY_KEY);
      sessionStorage.removeItem(SESSION_ANALYSIS_SNAPSHOTS_KEY);
      sessionStorage.removeItem(SESSION_WIDE_BASE_KEY);
      sessionStorage.removeItem(SESSION_DISPLAY_MODE_KEY);
    } catch {
      /* ignore */
    }
    clearActiveContributorsCache();
    setDisplayMode("live");
    setResult(null);
    setConfig(null);
    setWideSnapshot(null);
    setAnalysisCache(emptyAnalysisCache());
    setAnalysisHistory([]);
    setAnalysisSnapshots({});
    setLastAiConfig(null);
    setPhase("connect");
    setError("");
    setErrorSource(null);
    router.push("/");
  }, [router]);

  const loadBaseData = useCallback(
    async (cfg: ConnectAnalysisConfig, opts?: { refresh?: boolean }) => {
      const fromDashboard = opts?.refresh === true;
      setConfig(cfg);
      setError("");
      setErrorSource(null);

      if (!fromDashboard && wideSnapshot?.baseLoadedAt) {
        const loadedAt = new Date(wideSnapshot.baseLoadedAt).getTime();
        const age = Date.now() - loadedAt;
        if (
          Number.isFinite(loadedAt) &&
          age >= 0 &&
          age < LOAD_BASE_CLIENT_CACHE_MS &&
          wideConfigsEqual(wideSnapshot.config, cfg)
        ) {
          setPhase("done");
          setProgress("");
          setWideSnapshot(wideSnapshot);
          setResult(wideSnapshot.result);
          persistWideSnapshot(wideSnapshot);
          setDisplayMode("live");
          persistDisplayMode("live");
          persistSession(cfg, wideSnapshot.result, analysisCache, analysisHistory);
          if (wideSnapshot.result.developers?.length > 0) {
            setSelectedDev(wideSnapshot.result.developers[0].login);
          }
          if (!fromDashboard) {
            router.push("/repo");
          }
          return;
        }
      }

      setPhase("loading_data");
      setProgress(`Loading commits from ${cfg.repos.length} repos…`);

      try {
        const cacheSnapshot = analysisCache;
        const res = await fetch("/api/load-base", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...cfg,
            analysisCache: cacheSnapshot,
            commitLimitPerRepo: 2500,
          }),
        });
        const data = (await res.json()) as ApiSuccessBody & { error?: string };

        if (!data.success) {
          throw new Error(data.error ?? "Failed to load GitHub data");
        }

        const nextCache = data.analysisCache ?? emptyAnalysisCache();
        const {
          analysisCache: _ac,
          success: _s,
          databasePersistence: _dbp,
          analysisRunId: _arid,
          repoSyncAt,
          commitsDataSource: _cds,
          ...resultOnly
        } = data;
        const nextResult = normalizeAnalysisResult(resultOnly as AnalysisResult);

        const snap: WideBaseSnapshot = {
          config: cfg,
          result: nextResult,
          baseLoadedAt: new Date().toISOString(),
          ...(repoSyncAt && Object.keys(repoSyncAt).length > 0 ? { repoSyncAt } : {}),
          ...(data.commitsDataSource === "database" || data.commitsDataSource === "github"
            ? { commitsDataSource: data.commitsDataSource }
            : {}),
        };
        setWideSnapshot(snap);
        persistWideSnapshot(snap);
        setResult(nextResult);
        setAnalysisCache(nextCache);
        setDisplayMode("live");
        persistDisplayMode("live");
        setPhase("done");
        persistSession(cfg, nextResult, nextCache, analysisHistory);
        if (nextResult.developers?.length > 0) {
          setSelectedDev(nextResult.developers[0].login);
        }
        if (!fromDashboard) {
          router.push("/repo");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Load failed");
        setErrorSource("base");
        setPhase(fromDashboard ? "done" : "error");
      }
    },
    [analysisCache, analysisHistory, router, wideSnapshot],
  );

  const runScopedAiAnalysis = useCallback(
    async (cfg: ConnectAnalysisConfig) => {
      setPhase("analyzing_ai");
      setProgress(
        `Fetching diffs and running AI (cached SHAs skipped) for ${cfg.repos.length} repo(s)…`,
      );
      setError("");
      setErrorSource(null);
      setLastAiConfig(cfg);

      try {
        const res = await fetch("/api/analyze-impact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...cfg,
            analysisCache,
            commitLimitPerRepo: 200,
          }),
        });
        const data = (await res.json()) as ApiSuccessBody & { error?: string };

        if (!data.success) {
          throw new Error(data.error ?? "AI analysis failed");
        }

        const nextCache = data.analysisCache ?? analysisCache;
        const {
          analysisCache: _ac,
          success: _s,
          databasePersistence: _dbp,
          analysisRunId,
          repoSyncAt: _rsa,
          commitsDataSource: _cdsAi,
          ...resultOnly
        } = data;
        const nextResult = normalizeAnalysisResult(resultOnly as AnalysisResult);
        const tableStats = commitTableStats(nextResult.analyzedCommits);

        const runId = analysisRunId ?? crypto.randomUUID();
        const historyEntry: AnalysisHistoryEntry = {
          id: runId,
          repos: cfg.repos.map((r) => r.label),
          dateRange: { from: cfg.dateFrom, to: cfg.dateTo },
          runAt: new Date().toISOString(),
          commitsInWindow: tableStats.nonMergeInView,
          commitsAnalyzed: tableStats.analyzedWithAi,
        };
        const nextHistory = [historyEntry, ...analysisHistory.filter((h) => h.id !== runId)].slice(
          0,
          24,
        );

        setAnalysisSnapshots((prev) => {
          const mergedSnaps = { ...prev, [runId]: nextResult };
          const pruned = pruneAnalysisSnapshots(mergedSnaps, nextHistory);
          persistAnalysisSnapshots(pruned);
          return pruned;
        });

        const mergedResult = wideSnapshot
          ? mergeWideAndScopedAi(wideSnapshot.result, nextResult)
          : nextResult;
        const nextWideSnap: WideBaseSnapshot = wideSnapshot
          ? { ...wideSnapshot, result: mergedResult }
          : {
              config: cfg,
              result: mergedResult,
              baseLoadedAt: new Date().toISOString(),
            };
        setWideSnapshot(nextWideSnap);
        persistWideSnapshot(nextWideSnap);

        setResult(mergedResult);
        setConfig(cfg);
        setAnalysisCache(nextCache);
        setAnalysisHistory(nextHistory);
        setDisplayMode("live");
        persistDisplayMode("live");
        setPhase("done");
        persistSession(cfg, mergedResult, nextCache, nextHistory);
        if (nextResult.developers?.length > 0) {
          setSelectedDev(nextResult.developers[0].login);
        }
        router.push("/insights");
      } catch (err) {
        setError(err instanceof Error ? err.message : "AI analysis failed");
        setErrorSource("ai");
        setPhase("done");
      }
    },
    [analysisCache, analysisHistory, router, wideSnapshot],
  );

  const handleRefresh = useCallback(() => {
    const wc = wideSnapshot?.config;
    if (wc) void loadBaseData(wc, { refresh: true });
  }, [wideSnapshot, loadBaseData]);

  const historyRunHasSnapshot = useCallback(
    (historyId: string) => {
      if (databasePersistenceEnabled) {
        const s = analysisSnapshots[historyId];
        if (s && Array.isArray(s.developers)) return true;
        return analysisHistory.some((h) => h.id === historyId);
      }
      const s = analysisSnapshots[historyId];
      return Boolean(s && Array.isArray(s.developers));
    },
    [analysisHistory, analysisSnapshots, databasePersistenceEnabled],
  );

  const applyAnalysisHistoryRun = useCallback(
    async (historyId: string): Promise<boolean> => {
      const tok = wideSnapshot?.config.token ?? config?.token;
      const entry = analysisHistory.find((h) => h.id === historyId);

      if (databasePersistenceEnabled && tok) {
        try {
          const res = await fetch("/api/analysis/runs/restore", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: tok, runId: historyId }),
          });
          const data = (await res.json()) as {
            success?: boolean;
            result?: AnalysisResult;
          };
          if (data.success && data.result && Array.isArray(data.result.developers)) {
            const normalized = normalizeAnalysisResult(
              JSON.parse(JSON.stringify(data.result)) as AnalysisResult,
            );
            const fallbackRange = defaultAnalysisDateRange();
            const dateFrom =
              normalized.analysisWindow?.from ?? entry?.dateRange.from ?? fallbackRange.dateFrom;
            const dateTo =
              normalized.analysisWindow?.to ?? entry?.dateRange.to ?? fallbackRange.dateTo;
            const nextCfg: ConnectAnalysisConfig = {
              token: tok,
              repos: normalized.repos,
              dateFrom,
              dateTo,
            };
            setResult(normalized);
            setConfig(nextCfg);
            setDisplayMode("restored");
            persistDisplayMode("restored");
            persistSession(nextCfg, normalized, analysisCache, analysisHistory);
            if (normalized.developers?.length) {
              setSelectedDev(normalized.developers[0].login);
            }
            return true;
          }
        } catch {
          return false;
        }
      }

      const snap = analysisSnapshots[historyId];
      if (!snap || !Array.isArray(snap.developers)) return false;
      if (!tok) return false;

      let normalized: AnalysisResult;
      try {
        normalized = normalizeAnalysisResult(JSON.parse(JSON.stringify(snap)) as AnalysisResult);
      } catch {
        return false;
      }

      const fallbackRange = defaultAnalysisDateRange();
      const dateFrom =
        normalized.analysisWindow?.from ?? entry?.dateRange.from ?? fallbackRange.dateFrom;
      const dateTo = normalized.analysisWindow?.to ?? entry?.dateRange.to ?? fallbackRange.dateTo;
      const nextCfg: ConnectAnalysisConfig = {
        token: tok,
        repos: normalized.repos,
        dateFrom,
        dateTo,
      };

      setResult(normalized);
      setConfig(nextCfg);
      setDisplayMode("restored");
      persistDisplayMode("restored");
      persistSession(nextCfg, normalized, analysisCache, analysisHistory);
      if (normalized.developers?.length) {
        setSelectedDev(normalized.developers[0].login);
      }
      return true;
    },
    [
      analysisSnapshots,
      analysisHistory,
      wideSnapshot?.config.token,
      config?.token,
      analysisCache,
      databasePersistenceEnabled,
    ],
  );

  const dismissError = useCallback(() => {
    setError("");
    setErrorSource(null);
  }, []);

  const retryLastOperation = useCallback(() => {
    if (errorSource === "ai") {
      const c = lastAiConfig ?? config;
      if (c) void runScopedAiAnalysis(c);
      return;
    }
    const wc = wideSnapshot?.config ?? config;
    if (wc) void loadBaseData(wc, { refresh: result !== null });
  }, [
    config,
    errorSource,
    lastAiConfig,
    loadBaseData,
    result,
    runScopedAiAnalysis,
    wideSnapshot,
  ]);

  const value = useMemo(
    () => ({
      bootstrapped,
      phase,
      config,
      result,
      dataResult,
      wideSnapshot,
      analysisCache,
      analysisHistory,
      error,
      errorSource,
      progress,
      selectedDev,
      setSelectedDev,
      hoveredProfile,
      setHoveredProfile,
      loadBaseData,
      runScopedAiAnalysis,
      applyAnalysisHistoryRun,
      historyRunHasSnapshot,
      analysisSnapshots,
      displayMode,
      returnToLiveView,
      clearSessionAndGoConnect,
      handleRefresh,
      retryLastOperation,
      dismissError,
      databasePersistenceEnabled,
    }),
    [
      bootstrapped,
      phase,
      config,
      result,
      dataResult,
      wideSnapshot,
      analysisCache,
      analysisHistory,
      error,
      errorSource,
      progress,
      selectedDev,
      hoveredProfile,
      loadBaseData,
      runScopedAiAnalysis,
      applyAnalysisHistoryRun,
      historyRunHasSnapshot,
      analysisSnapshots,
      displayMode,
      returnToLiveView,
      clearSessionAndGoConnect,
      handleRefresh,
      retryLastOperation,
      dismissError,
      databasePersistenceEnabled,
    ],
  );

  return (
    <AnalysisSessionContext.Provider value={value}>{children}</AnalysisSessionContext.Provider>
  );
}
