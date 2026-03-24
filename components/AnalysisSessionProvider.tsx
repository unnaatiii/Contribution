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
import type { AnalysisResult } from "@/lib/types";
import type { ConnectAnalysisConfig } from "@/app/components/ConnectForm";
import { defaultAnalysisDateRange } from "@/lib/date-range";

export type Phase = "connect" | "analyzing" | "done" | "error";

export const SESSION_RESULT_KEY = "devimpact-result";
export const SESSION_CONFIG_KEY = "devimpact-config";

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

type AnalysisSessionValue = {
  bootstrapped: boolean;
  phase: Phase;
  config: ConnectAnalysisConfig | null;
  result: AnalysisResult | null;
  error: string;
  progress: string;
  selectedDev: string | null;
  setSelectedDev: (v: string | null) => void;
  hoveredProfile: string | null;
  setHoveredProfile: (v: string | null) => void;
  runAnalysis: (cfg: ConnectAnalysisConfig) => Promise<void>;
  clearSessionAndGoConnect: () => void;
  handleRefresh: () => void;
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
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [selectedDev, setSelectedDev] = useState<string | null>(null);
  const [hoveredProfile, setHoveredProfile] = useState<string | null>(null);

  useEffect(() => {
    try {
      const resRaw = sessionStorage.getItem(SESSION_RESULT_KEY);
      if (resRaw) {
        const data = JSON.parse(resRaw) as AnalysisResult & { success?: boolean };
        if (Array.isArray(data.developers)) {
          setResult(data);
          setPhase("done");
          const cfgRaw = sessionStorage.getItem(SESSION_CONFIG_KEY);
          if (cfgRaw) {
            const parsed = normalizeStoredConfig(JSON.parse(cfgRaw));
            if (parsed) setConfig(parsed);
          }
          if (data.developers.length > 0) {
            setSelectedDev((prev) => prev ?? data.developers[0].login);
          }
        }
      }
    } catch {
      /* ignore */
    } finally {
      setBootstrapped(true);
    }
  }, []);

  const clearSessionAndGoConnect = useCallback(() => {
    try {
      sessionStorage.removeItem(SESSION_RESULT_KEY);
      sessionStorage.removeItem(SESSION_CONFIG_KEY);
    } catch {
      /* ignore */
    }
    setResult(null);
    setConfig(null);
    setPhase("connect");
    setError("");
    router.push("/");
  }, [router]);

  const runAnalysis = useCallback(
    async (cfg: ConnectAnalysisConfig) => {
      setConfig(cfg);
      setPhase("analyzing");
      setProgress(`Fetching data from ${cfg.repos.length} repos and running AI analysis...`);
      setError("");

      try {
        const res = await fetch("/api/analyze-impact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cfg),
        });
        const data = await res.json();

        if (!data.success) {
          throw new Error(data.error);
        }

        setResult(data);
        setPhase("done");
        try {
          sessionStorage.setItem(SESSION_RESULT_KEY, JSON.stringify(data));
          sessionStorage.setItem(SESSION_CONFIG_KEY, JSON.stringify(cfg));
        } catch {
          /* quota — ignore */
        }
        if (data.developers?.length > 0) {
          setSelectedDev(data.developers[0].login);
        }
        router.push("/insights");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Analysis failed");
        setPhase("error");
      }
    },
    [router],
  );

  const handleRefresh = useCallback(() => {
    if (config) void runAnalysis(config);
  }, [config, runAnalysis]);

  const value = useMemo(
    () => ({
      bootstrapped,
      phase,
      config,
      result,
      error,
      progress,
      selectedDev,
      setSelectedDev,
      hoveredProfile,
      setHoveredProfile,
      runAnalysis,
      clearSessionAndGoConnect,
      handleRefresh,
    }),
    [
      bootstrapped,
      phase,
      config,
      result,
      error,
      progress,
      selectedDev,
      hoveredProfile,
      runAnalysis,
      clearSessionAndGoConnect,
      handleRefresh,
    ],
  );

  return (
    <AnalysisSessionContext.Provider value={value}>{children}</AnalysisSessionContext.Provider>
  );
}
