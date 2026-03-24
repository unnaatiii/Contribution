"use client";

import { useState, useMemo } from "react";
import {
  GitBranch,
  Key,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Search,
  CheckSquare,
  Square,
  CalendarRange,
} from "lucide-react";
import type { RepoConfig } from "@/lib/types";
import {
  defaultAnalysisDateRange,
  toYMD,
  validateAnalysisDateRange,
} from "@/lib/date-range";

export type ConnectAnalysisConfig = {
  token: string;
  repos: RepoConfig[];
  dateFrom: string;
  dateTo: string;
};

interface ConnectFormProps {
  onConnected: (config: ConnectAnalysisConfig) => void;
}

type ListedRepo = {
  owner: string;
  repo: string;
  fullName: string;
  description: string | null;
  private: boolean;
  htmlUrl: string;
  defaultBranch: string;
};

type RepoType = "frontend" | "backend" | "erp";

/** Per-repo overrides when selected (key = fullName) */
type RepoOverrides = Record<
  string,
  { label: string; repoType: RepoType }
>;

function guessRepoType(name: string): RepoType {
  const n = name.toLowerCase();
  if (/portal|ui|web|client|app|frontend|next|react|vue/.test(n)) return "frontend";
  if (/erp|admin|dashboard|internal/.test(n)) return "erp";
  return "backend";
}

export default function ConnectForm({ onConnected }: ConnectFormProps) {
  const [step, setStep] = useState<"pat" | "select">("pat");
  const [token, setToken] = useState("");
  const defaultRange = useMemo(() => defaultAnalysisDateRange(), []);
  const [dateFrom, setDateFrom] = useState(defaultRange.dateFrom);
  const [dateTo, setDateTo] = useState(defaultRange.dateTo);
  const [githubLogin, setGithubLogin] = useState<string | null>(null);
  const [fetchedRepos, setFetchedRepos] = useState<ListedRepo[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<RepoOverrides>({});
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const filteredRepos = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return fetchedRepos;
    return fetchedRepos.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        (r.description?.toLowerCase().includes(q) ?? false),
    );
  }, [fetchedRepos, search]);

  const toggleKey = (fullName: string, checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(fullName);
        setOverrides((o) => {
          if (o[fullName]) return o;
          const item = fetchedRepos.find((r) => r.fullName === fullName);
          const repoName = item?.repo ?? fullName.split("/")[1] ?? fullName;
          return {
            ...o,
            [fullName]: {
              label: repoName,
              repoType: guessRepoType(repoName),
            },
          };
        });
      } else {
        next.delete(fullName);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const r of filteredRepos) {
        next.add(r.fullName);
      }
      setOverrides((o) => {
        const copy = { ...o };
        for (const r of filteredRepos) {
          if (!copy[r.fullName]) {
            copy[r.fullName] = {
              label: r.repo,
              repoType: guessRepoType(r.repo),
            };
          }
        }
        return copy;
      });
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedKeys(new Set());
  };

  const updateOverride = (fullName: string, field: "label" | "repoType", value: string) => {
    setOverrides((o) => ({
      ...o,
      [fullName]: {
        label: o[fullName]?.label ?? fullName.split("/")[1] ?? fullName,
        repoType: o[fullName]?.repoType ?? "backend",
        [field]: field === "repoType" ? (value as RepoType) : value,
      },
    }));
  };

  const handleFetchRepos = async () => {
    if (!token.trim()) {
      setStatus("error");
      setMessage("Enter your Personal Access Token first.");
      return;
    }

    setStatus("loading");
    setMessage("Fetching repositories from GitHub...");

    try {
      const res = await fetch("/api/github/list-repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setStatus("error");
        setMessage(data.error ?? "Could not list repositories");
        return;
      }

      setFetchedRepos(data.repos ?? []);
      setGithubLogin(data.login ?? null);
      setSelectedKeys(new Set());
      setOverrides({});
      setSearch("");
      setStep("select");
      setStatus("idle");
      setMessage("");
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
  };

  const applyPresetDays = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - days);
    setDateFrom(toYMD(from));
    setDateTo(toYMD(to));
  };

  const todayYmd = useMemo(() => toYMD(new Date()), []);

  const handleRunAnalysis = async () => {
    if (selectedKeys.size === 0) {
      setStatus("error");
      setMessage("Select at least one repository.");
      return;
    }

    const rangeCheck = validateAnalysisDateRange(dateFrom, dateTo);
    if (!rangeCheck.ok) {
      setStatus("error");
      setMessage(rangeCheck.error);
      return;
    }

    const parsedRepos: RepoConfig[] = [];
    for (const fullName of selectedKeys) {
      const item = fetchedRepos.find((r) => r.fullName === fullName);
      if (!item) continue;
      const ov = overrides[fullName] ?? {
        label: item.repo,
        repoType: guessRepoType(item.repo),
      };
      parsedRepos.push({
        owner: item.owner,
        repo: item.repo,
        label: ov.label.trim() || item.repo,
        repoType: ov.repoType,
      });
    }

    if (parsedRepos.length === 0) {
      setStatus("error");
      setMessage("No valid repositories selected.");
      return;
    }

    setStatus("loading");
    setMessage(`Starting analysis on ${parsedRepos.length} repo(s)...`);

    try {
      const res = await fetch("/api/github/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), repos: parsedRepos }),
      });
      const data = await res.json();

      if (data.success) {
        setStatus("success");
        setMessage(`Connected. Running analysis...`);
        onConnected({
          token: token.trim(),
          repos: parsedRepos,
          dateFrom,
          dateTo,
        });
      } else {
        setStatus("error");
        setMessage(data.error ?? "Connection failed");
      }
    } catch {
      setStatus("error");
      setMessage("Connection failed. Check your network.");
    }
  };

  const goBackToPat = () => {
    setStep("pat");
    setFetchedRepos([]);
    setSelectedKeys(new Set());
    setOverrides({});
    setGithubLogin(null);
    setSearch("");
    setStatus("idle");
    setMessage("");
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="cursor-panel rounded-2xl p-8 backdrop-blur-xl shadow-2xl shadow-black/50 animate-fade-rise">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-accent/15 rounded-xl ring-1 ring-accent/25">
            <GitBranch className="w-6 h-6 text-accent" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-white">
              {step === "pat" ? "Connect with GitHub" : "Select repositories"}
            </h2>
            <p className="text-sm text-zinc-400">
              {step === "pat"
                ? "Enter your PAT — we’ll load every repo your account can access."
                : githubLogin
                  ? `Signed in as @${githubLogin} · ${fetchedRepos.length} repos found`
                  : `${fetchedRepos.length} repositories`}
            </p>
          </div>
          {step === "select" && (
            <button
              type="button"
              onClick={goBackToPat}
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Change token
            </button>
          )}
        </div>

        {step === "pat" && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Personal Access Token
              </label>
              <div className="relative">
                <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20 transition-all text-sm"
                />
              </div>
              <p className="mt-1.5 text-xs text-zinc-500">
                Needs <code className="text-zinc-400">repo</code> scope to read commits and PRs.{" "}
                <a
                  href="https://github.com/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:text-accent-hover transition-colors"
                >
                  Generate token
                </a>
              </p>
            </div>

            <button
              type="button"
              onClick={handleFetchRepos}
              disabled={status === "loading"}
              className="w-full py-3 px-6 bg-accent hover:bg-accent-hover disabled:bg-accent/50 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed text-sm"
            >
              {status === "loading" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading repositories...
                </>
              ) : (
                "Fetch my repositories"
              )}
            </button>
          </div>
        )}

        {step === "select" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or description..."
                  className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-accent/50"
                />
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={selectAllVisible}
                  className="text-xs px-3 py-2 rounded-lg border border-white/10 text-zinc-300 hover:bg-white/5"
                >
                  Select visible
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-xs px-3 py-2 rounded-lg border border-white/10 text-zinc-300 hover:bg-white/5"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="max-h-[280px] overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5">
              {filteredRepos.length === 0 ? (
                <p className="p-6 text-sm text-zinc-500 text-center">No repositories match your search.</p>
              ) : (
                filteredRepos.map((r) => {
                  const checked = selectedKeys.has(r.fullName);
                  return (
                    <label
                      key={r.fullName}
                      className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-white/[0.03] ${
                        checked ? "bg-accent/10" : ""
                      }`}
                    >
                      <span className="mt-0.5 text-zinc-400">
                        {checked ? (
                          <CheckSquare className="w-5 h-5 text-accent" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </span>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={(e) => toggleKey(r.fullName, e.target.checked)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white">{r.fullName}</span>
                          {r.private && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300">
                              Private
                            </span>
                          )}
                        </div>
                        {r.description && (
                          <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{r.description}</p>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            {selectedKeys.size > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-zinc-300">
                  Configure selected ({selectedKeys.size})
                </p>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {Array.from(selectedKeys).map((fullName) => {
                    const item = fetchedRepos.find((x) => x.fullName === fullName);
                    const ov =
                      overrides[fullName] ??
                      (item
                        ? { label: item.repo, repoType: guessRepoType(item.repo) }
                        : { label: fullName, repoType: "backend" as RepoType });
                    return (
                      <div
                        key={fullName}
                        className="flex flex-col sm:flex-row gap-2 sm:items-center p-3 rounded-lg bg-white/[0.03] border border-white/5"
                      >
                        <span className="text-xs text-zinc-400 sm:w-40 shrink-0 truncate" title={fullName}>
                          {fullName}
                        </span>
                        <input
                          type="text"
                          value={ov.label}
                          onChange={(e) => updateOverride(fullName, "label", e.target.value)}
                          placeholder="Display label"
                          className="flex-1 min-w-0 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                        />
                        <select
                          value={ov.repoType}
                          onChange={(e) => updateOverride(fullName, "repoType", e.target.value)}
                          className="w-full sm:w-32 px-2 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                        >
                          <option value="frontend" className="bg-zinc-900">
                            Frontend
                          </option>
                          <option value="backend" className="bg-zinc-900">
                            Backend
                          </option>
                          <option value="erp" className="bg-zinc-900">
                            ERP
                          </option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                <CalendarRange className="w-4 h-4 text-accent shrink-0" />
                Analysis period
              </div>
              <p className="text-xs text-zinc-500">
                Commits and PRs in this range are fetched from GitHub (up to 100 commits per repo).
              </p>
              <div className="flex flex-wrap gap-2">
                {([7, 14, 30, 90] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => applyPresetDays(d)}
                    className="text-xs px-2.5 py-1 rounded-lg border border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Last {d}d
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    max={dateTo}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">To</label>
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom}
                    max={todayYmd}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent/50"
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRunAnalysis}
              disabled={status === "loading" || selectedKeys.size === 0}
              className="w-full py-3 px-6 bg-accent hover:bg-accent-hover disabled:bg-accent/30 disabled:text-zinc-500 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed text-sm"
            >
              {status === "loading" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting...
                </>
              ) : (
                `Run analysis on ${selectedKeys.size} repo${selectedKeys.size === 1 ? "" : "s"}`
              )}
            </button>
          </div>
        )}

        {message && (
          <div
            className={`mt-4 flex items-start gap-2 p-3 rounded-xl text-sm ${
              status === "success"
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                : status === "error"
                  ? "bg-red-500/10 border border-red-500/20 text-red-400"
                  : "bg-zinc-500/10 border border-zinc-500/20 text-zinc-400"
            }`}
          >
            {status === "success" ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            ) : status === "error" ? (
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            ) : null}
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
