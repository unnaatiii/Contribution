"use client";

import { useState, useMemo, useReducer } from "react";
import { motion } from "framer-motion";
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
  Users,
  ExternalLink,
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
  /** When set, only these GitHub logins are included in analysis (people you selected from GitHub). */
  allowedLogins?: string[];
};

type TeamMemberRow = {
  login: string;
  avatar_url: string;
  html_url: string | null;
  /** Present when list came from GitHub “contributors” (commit counts, summed across repos). */
  contributions?: number;
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

type SelectionState = { keys: Set<string>; overrides: RepoOverrides };

type SelectionAction =
  | { type: "toggle"; fullName: string; checked: boolean; fetchedRepos: ListedRepo[] }
  | { type: "selectAllVisible"; repos: ListedRepo[] }
  | { type: "clear" }
  | {
      type: "updateOverride";
      fullName: string;
      field: "label" | "repoType";
      value: string;
    };

function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
  switch (action.type) {
    case "toggle": {
      const { fullName, checked, fetchedRepos } = action;
      const keys = new Set(state.keys);
      if (checked) {
        keys.add(fullName);
        if (state.overrides[fullName]) return { keys, overrides: state.overrides };
        const item = fetchedRepos.find((r) => r.fullName === fullName);
        const repoName = item?.repo ?? fullName.split("/")[1] ?? fullName;
        return {
          keys,
          overrides: {
            ...state.overrides,
            [fullName]: { label: repoName, repoType: guessRepoType(repoName) },
          },
        };
      }
      keys.delete(fullName);
      if (!state.overrides[fullName]) return { keys, overrides: state.overrides };
      const overrides = { ...state.overrides };
      delete overrides[fullName];
      return { keys, overrides };
    }
    case "selectAllVisible": {
      const keys = new Set(state.keys);
      const overrides = { ...state.overrides };
      for (const r of action.repos) {
        keys.add(r.fullName);
        if (!overrides[r.fullName]) {
          overrides[r.fullName] = { label: r.repo, repoType: guessRepoType(r.repo) };
        }
      }
      return { keys, overrides };
    }
    case "clear":
      return { keys: new Set(), overrides: {} };
    case "updateOverride": {
      const { fullName, field, value } = action;
      return {
        ...state,
        overrides: {
          ...state.overrides,
          [fullName]: {
            label: state.overrides[fullName]?.label ?? fullName.split("/")[1] ?? fullName,
            repoType: state.overrides[fullName]?.repoType ?? "backend",
            [field]: field === "repoType" ? (value as RepoType) : value,
          },
        },
      };
    }
    default:
      return state;
  }
}

export default function ConnectForm({ onConnected }: ConnectFormProps) {
  const [step, setStep] = useState<"pat" | "select">("pat");
  const [token, setToken] = useState("");
  const defaultRange = useMemo(() => defaultAnalysisDateRange(), []);
  const [dateFrom, setDateFrom] = useState(defaultRange.dateFrom);
  const [dateTo, setDateTo] = useState(defaultRange.dateTo);
  const [githubLogin, setGithubLogin] = useState<string | null>(null);
  const [fetchedRepos, setFetchedRepos] = useState<ListedRepo[]>([]);
  const [selection, dispatchSelection] = useReducer(selectionReducer, {
    keys: new Set<string>(),
    overrides: {} as RepoOverrides,
  });
  const selectedKeys = selection.keys;
  const overrides = selection.overrides;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const [restrictToTeam, setRestrictToTeam] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [teamPick, setTeamPick] = useState<Set<string>>(new Set());
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState("");
  const [teamWarnings, setTeamWarnings] = useState<string[]>([]);
  const [teamListSource, setTeamListSource] = useState<"collaborators" | "contributors" | null>(null);

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
    dispatchSelection({ type: "toggle", fullName, checked, fetchedRepos });
  };

  const selectAllVisible = () => {
    dispatchSelection({ type: "selectAllVisible", repos: filteredRepos });
  };

  const clearSelection = () => dispatchSelection({ type: "clear" });

  const updateOverride = (fullName: string, field: "label" | "repoType", value: string) => {
    dispatchSelection({ type: "updateOverride", fullName, field, value });
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
      dispatchSelection({ type: "clear" });
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

  const buildParsedRepos = (): RepoConfig[] => {
    const out: RepoConfig[] = [];
    for (const fullName of selectedKeys) {
      const item = fetchedRepos.find((r) => r.fullName === fullName);
      if (!item) continue;
      const ov = overrides[fullName] ?? {
        label: item.repo,
        repoType: guessRepoType(item.repo),
      };
      out.push({
        owner: item.owner,
        repo: item.repo,
        label: ov.label.trim() || item.repo,
        repoType: ov.repoType,
      });
    }
    return out;
  };

  const loadTeamFromGitHub = async (source: "collaborators" | "contributors") => {
    const parsedRepos = buildParsedRepos();
    if (parsedRepos.length === 0) {
      setTeamError("Select repositories first.");
      return;
    }
    if (!token.trim()) {
      setTeamError("Token missing.");
      return;
    }
    setTeamLoading(true);
    setTeamError("");
    setTeamWarnings([]);
    const path =
      source === "collaborators"
        ? "/api/github/repo-collaborators"
        : "/api/github/repo-contributors";
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), repos: parsedRepos }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setTeamError(
          data.error ??
            (source === "collaborators"
              ? "Could not load collaborators"
              : "Could not load contributors"),
        );
        setTeamMembers([]);
        setTeamPick(new Set());
        setTeamListSource(null);
        return;
      }
      const members = (data.members ?? []) as TeamMemberRow[];
      setTeamMembers(members);
      setTeamPick(new Set(members.map((m) => m.login.toLowerCase())));
      setTeamListSource(source);
      if (Array.isArray(data.warnings)) setTeamWarnings(data.warnings);
    } catch {
      setTeamError(
        source === "collaborators"
          ? "Network error loading collaborators."
          : "Network error loading contributors.",
      );
      setTeamMembers([]);
      setTeamPick(new Set());
      setTeamListSource(null);
    } finally {
      setTeamLoading(false);
    }
  };

  const toggleTeamLogin = (login: string) => {
    const k = login.toLowerCase();
    setTeamPick((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const selectAllTeam = () => {
    setTeamPick(new Set(teamMembers.map((m) => m.login.toLowerCase())));
  };

  const selectNoTeam = () => setTeamPick(new Set());

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

    const parsedRepos = buildParsedRepos();

    if (restrictToTeam) {
      if (teamMembers.length === 0) {
        setStatus("error");
        setMessage(
          'Turn on team filter only after loading a list from GitHub (“repo access” or “contributors”).',
        );
        return;
      }
      if (teamPick.size === 0) {
        setStatus("error");
        setMessage("Select at least one person for team-restricted analysis.");
        return;
      }
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
          ...(restrictToTeam && teamPick.size > 0
            ? {
                allowedLogins: teamMembers
                  .filter((m) => teamPick.has(m.login.toLowerCase()))
                  .map((m) => m.login),
              }
            : {}),
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
    dispatchSelection({ type: "clear" });
    setGithubLogin(null);
    setSearch("");
    setStatus("idle");
    setMessage("");
    setRestrictToTeam(false);
    setTeamMembers([]);
    setTeamPick(new Set());
    setTeamError("");
    setTeamWarnings([]);
    setTeamListSource(null);
  };

  const patLandingCard =
    "rounded-3xl bg-[#081257]/72 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/40 p-8 md:p-10 transition-all duration-300 ease-out hover:scale-[1.02] hover:border-white/15 hover:shadow-blue-500/15";

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        className={
          step === "pat"
            ? patLandingCard
            : "connect-select-card p-8 md:p-10 shadow-2xl shadow-black/50 animate-fade-rise max-h-[min(92svh,1040px)] overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]"
        }
      >
        <div className="flex items-center gap-3 mb-8">
          <div
            className={
              step === "pat"
                ? "p-2.5 rounded-[16px] bg-gradient-to-br from-blue-950/45 to-blue-600/25 ring-1 ring-white/10"
                : "p-2.5 rounded-[16px] bg-gradient-to-br from-purple-500/20 to-blue-500/20 ring-1 ring-white/10"
            }
          >
            <GitBranch
              className={
                step === "pat" ? "w-6 h-6 text-sky-300" : "w-6 h-6 text-purple-300"
              }
            />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-semibold text-white tracking-tight">
              {step === "pat" ? "Connect with GitHub" : "Select repositories"}
            </h2>
            <p
              className={
                step === "pat"
                  ? "text-sm text-gray-400 mt-0.5"
                  : "text-sm text-zinc-200/95 mt-0.5"
              }
            >
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
              className="text-xs text-zinc-300 hover:text-white flex items-center gap-1 px-2 py-1 rounded-[12px] hover:bg-white/10 transition-all duration-300"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Change token
            </button>
          )}
        </div>

        {step === "pat" && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Personal Access Token
              </label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/10 rounded-full text-white placeholder:text-gray-300 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all duration-300 text-sm"
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                Needs <code className="text-gray-400">repo</code> scope to read commits and PRs.{" "}
                <a
                  href="https://github.com/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:text-blue-300 transition-all duration-300"
                >
                  Generate token
                </a>
              </p>
            </div>

            <motion.button
              type="button"
              onClick={handleFetchRepos}
              disabled={status === "loading"}
              whileHover={status === "loading" ? undefined : { scale: 1.05 }}
              whileTap={status === "loading" ? undefined : { scale: 0.98 }}
              className="w-full py-3 px-6 rounded-full font-semibold text-white flex items-center justify-center gap-2 bg-gradient-to-r from-blue-700 to-blue-500 shadow-lg shadow-blue-600/35 hover:shadow-blue-500/45 hover:from-blue-600 hover:to-sky-400 transition-all duration-300 disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:from-blue-700 disabled:hover:to-blue-500"
            >
              {status === "loading" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading repositories...
                </>
              ) : (
                "Fetch my repositories"
              )}
            </motion.button>
          </div>
        )}

        {step === "select" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or description..."
                  className="w-full pl-10 pr-3 py-2.5 rounded-[14px] text-sm text-zinc-50 placeholder:text-zinc-500 bg-slate-950/70 border border-zinc-500/35 focus:outline-none focus:border-violet-400/55 focus:ring-1 focus:ring-violet-400/25 transition-all duration-300"
                />
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={selectAllVisible}
                  className="text-xs px-3 py-2 rounded-[12px] border border-zinc-500/35 text-zinc-100 bg-slate-950/50 hover:bg-slate-900/80 hover:border-zinc-400/45 transition-all duration-300"
                >
                  Select visible
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-xs px-3 py-2 rounded-[12px] border border-zinc-500/35 text-zinc-100 bg-slate-950/50 hover:bg-slate-900/80 hover:border-zinc-400/45 transition-all duration-300"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="max-h-[280px] overflow-y-auto rounded-[16px] border border-zinc-500/30 divide-y divide-zinc-600/25 bg-slate-950/75 shadow-inner shadow-black/20">
              {filteredRepos.length === 0 ? (
                <p className="p-6 text-sm text-zinc-400 text-center">No repositories match your search.</p>
              ) : (
                filteredRepos.map((r) => {
                  const checked = selectedKeys.has(r.fullName);
                  return (
                    <label
                      key={r.fullName}
                      className={`flex items-start gap-3 p-3 cursor-pointer transition-all duration-300 hover:bg-white/[0.06] ${
                        checked ? "bg-violet-500/18" : ""
                      }`}
                    >
                      <span className="mt-0.5 text-zinc-300">
                        {checked ? (
                          <CheckSquare className="w-5 h-5 text-violet-300" />
                        ) : (
                          <Square className="w-5 h-5 text-zinc-500" />
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
                          <span className="text-sm font-medium text-zinc-50 tracking-tight">{r.fullName}</span>
                          {r.private && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-800/90 text-zinc-200 border border-zinc-600/40 font-medium">
                              Private
                            </span>
                          )}
                        </div>
                        {r.description && (
                          <p className="text-xs text-zinc-300 mt-0.5 line-clamp-1">{r.description}</p>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            {selectedKeys.size > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-zinc-100">
                  Configure selected ({selectedKeys.size})
                </p>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {Array.from(selectedKeys)
                    .sort((a, b) => a.localeCompare(b))
                    .map((fullName) => {
                    const item = fetchedRepos.find((x) => x.fullName === fullName);
                    const ov =
                      overrides[fullName] ??
                      (item
                        ? { label: item.repo, repoType: guessRepoType(item.repo) }
                        : { label: fullName, repoType: "backend" as RepoType });
                    return (
                      <div
                        key={fullName}
                        className="flex flex-col sm:flex-row gap-2 sm:items-center p-3 rounded-[14px] bg-slate-950/60 border border-zinc-500/30"
                      >
                        <span
                          className="text-xs text-zinc-200 sm:w-40 shrink-0 truncate font-medium"
                          title={fullName}
                        >
                          {fullName}
                        </span>
                        <input
                          type="text"
                          value={ov.label}
                          onChange={(e) => updateOverride(fullName, "label", e.target.value)}
                          placeholder="Display label"
                          className="flex-1 min-w-0 px-3 py-2 rounded-lg text-sm text-zinc-50 placeholder:text-zinc-500 bg-slate-950/70 border border-zinc-500/35 focus:outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/20"
                        />
                        <select
                          value={ov.repoType}
                          onChange={(e) => updateOverride(fullName, "repoType", e.target.value)}
                          className="w-full sm:w-32 px-2 py-2 rounded-lg text-sm text-zinc-50 bg-slate-950/70 border border-zinc-500/35 focus:outline-none focus:border-violet-400/50"
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

            {selectedKeys.size > 0 && (
              <div className="rounded-[16px] border border-zinc-500/30 bg-slate-950/65 backdrop-blur-sm p-4 space-y-3 shadow-inner shadow-black/15">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-50">
                  <Users className="w-4 h-4 text-emerald-400 shrink-0" />
                  Team (from your GitHub account / repos)
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Load lists straight from GitHub using your PAT:{" "}
                  <strong className="text-zinc-300">Collaborators</strong> = people with access (like repo
                  settings). <strong className="text-zinc-300">Contributors</strong> = everyone GitHub
                  attributes commits to on those repos (like the Insights → Contributors graph), with
                  commit counts summed across your selected repos. Commits in analysis still follow GitHub
                  author metadata — use the filter to limit scoring to people you trust.
                </p>
                {teamListSource && (
                  <p className="text-[11px] text-emerald-400/90">
                    Current list:{" "}
                    {teamListSource === "collaborators"
                      ? "Collaborators (repo access)"
                      : "Contributors (commit history)"}
                  </p>
                )}
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 rounded border-zinc-500 bg-slate-950"
                    checked={restrictToTeam}
                    onChange={(e) => setRestrictToTeam(e.target.checked)}
                  />
                  <span className="text-sm text-zinc-200">
                    Only analyze commits &amp; reviews from the people I select below
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => loadTeamFromGitHub("collaborators")}
                    disabled={teamLoading}
                    className="text-xs px-3 py-2 rounded-[12px] border border-emerald-500/35 text-emerald-100 bg-emerald-950/40 hover:bg-emerald-900/50 transition-all duration-300 disabled:opacity-50"
                  >
                    {teamLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Loading…
                      </span>
                    ) : (
                      "Load collaborators (access)"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => loadTeamFromGitHub("contributors")}
                    disabled={teamLoading}
                    className="text-xs px-3 py-2 rounded-[12px] border border-sky-500/35 text-sky-100 bg-sky-950/40 hover:bg-sky-900/50 transition-all duration-300 disabled:opacity-50"
                  >
                    {teamLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Loading…
                      </span>
                    ) : (
                      "Load contributors (commits)"
                    )}
                  </button>
                  {teamMembers.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={selectAllTeam}
                        className="text-xs px-3 py-2 rounded-[12px] border border-zinc-500/35 text-zinc-200 bg-slate-900/80 hover:bg-slate-800 transition-all duration-300"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={selectNoTeam}
                        className="text-xs px-3 py-2 rounded-[12px] border border-zinc-500/35 text-zinc-200 bg-slate-900/80 hover:bg-slate-800 transition-all duration-300"
                      >
                        Clear selection
                      </button>
                    </>
                  )}
                </div>
                {teamError && (
                  <p className="text-xs text-red-400 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {teamError}
                  </p>
                )}
                {teamWarnings.length > 0 && (
                  <ul className="text-[11px] text-amber-200/90 space-y-1 list-disc list-inside">
                    {teamWarnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                )}
                {teamMembers.length > 0 && (
                  <div className="max-h-[220px] overflow-y-auto rounded-[12px] border border-zinc-600/30 divide-y divide-zinc-700/40 bg-slate-950/50">
                    {teamMembers.map((m) => {
                      const on = teamPick.has(m.login.toLowerCase());
                      return (
                        <label
                          key={m.login}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-white/[0.04] ${on ? "bg-emerald-500/10" : ""}`}
                        >
                          <input
                            type="checkbox"
                            className="rounded border-zinc-500 bg-slate-950 shrink-0"
                            checked={on}
                            onChange={() => toggleTeamLogin(m.login)}
                          />
                          <img
                            src={m.avatar_url}
                            alt=""
                            className="w-8 h-8 rounded-full ring-1 ring-white/10 shrink-0"
                          />
                          <div className="min-w-0 flex-1 flex items-center flex-wrap gap-x-2 gap-y-0.5">
                            <span className="text-sm font-medium text-zinc-100">{m.login}</span>
                            {typeof m.contributions === "number" && m.contributions > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-600/50">
                                {m.contributions} commits (GitHub)
                              </span>
                            )}
                            {m.html_url && (
                              <a
                                href={m.html_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-2 text-[10px] text-sky-400 hover:text-sky-300 inline-flex items-center gap-0.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                GitHub <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
                {restrictToTeam && teamMembers.length > 0 && (
                  <p className="text-[11px] text-zinc-500">
                    {teamPick.size} of {teamMembers.length} selected · commits from anyone else are skipped
                  </p>
                )}
              </div>
            )}

            <div className="rounded-[16px] border border-zinc-500/30 bg-slate-950/65 backdrop-blur-sm p-4 space-y-3 shadow-inner shadow-black/15">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-50">
                <CalendarRange className="w-4 h-4 text-sky-400 shrink-0" />
                Analysis period
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Commits and PRs in this range are fetched from GitHub (up to 100 commits per repo).
              </p>
              <div className="flex flex-wrap gap-2">
                {([7, 14, 30, 90] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => applyPresetDays(d)}
                    className="text-xs px-2.5 py-1.5 rounded-[12px] border border-zinc-500/35 text-zinc-100 bg-slate-900/80 hover:bg-slate-800 hover:border-zinc-400/45 transition-all duration-300 cursor-pointer font-medium"
                  >
                    Last {d}d
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-200 mb-1.5">From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    max={dateTo}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="connect-select-date-input w-full px-3 py-2.5 rounded-[12px] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-200 mb-1.5">To</label>
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom}
                    max={todayYmd}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="connect-select-date-input w-full px-3 py-2.5 rounded-[12px] text-sm"
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRunAnalysis}
              disabled={status === "loading" || selectedKeys.size === 0}
              className="w-full py-3.5 px-6 rounded-[20px] font-medium btn-gradient-saas flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
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
