"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { GitBranch, Key, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import type { RepoConfig } from "@/lib/types";
import { orgWideHistoryDateRange, validateWideDashboardDateRange } from "@/lib/date-range";
import { backendApiUrl } from "@/lib/backend-url";

export type ConnectAnalysisConfig = {
  token: string;
  repos: RepoConfig[];
  dateFrom: string;
  dateTo: string;
  allowedLogins?: string[];
};

type ListedRepo = {
  owner: string;
  repo: string;
  fullName: string;
};

type RepoType = "frontend" | "backend" | "erp";

function guessRepoType(name: string): RepoType {
  const n = name.toLowerCase();
  if (/portal|ui|web|client|app|frontend|next|react|vue/.test(n)) return "frontend";
  if (/erp|admin|dashboard|internal/.test(n)) return "erp";
  return "backend";
}

/** Build RepoConfig for every repo returned by list-repos (used after PAT). */
export function listedReposToRepoConfigs(listed: ListedRepo[]): RepoConfig[] {
  return listed.map((item) => ({
    owner: item.owner,
    repo: item.repo,
    label: item.repo,
    repoType: guessRepoType(item.repo),
  }));
}

interface ConnectFormProps {
  onConnected: (config: ConnectAnalysisConfig) => void;
}

export default function ConnectForm({ onConnected }: ConnectFormProps) {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleOpenDashboard = async () => {
    if (!token.trim()) {
      setStatus("error");
      setMessage("Enter your Personal Access Token first.");
      return;
    }

    setStatus("loading");
    setMessage("Listing repositories and loading your dashboard…");

    try {
      const listRes = await fetch(backendApiUrl("/api/github/list-repos"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const listData = await listRes.json();

      if (!listRes.ok || !listData.success) {
        setStatus("error");
        setMessage(listData.error ?? "Could not list repositories");
        return;
      }

      const listed = (listData.repos ?? []) as ListedRepo[];
      if (listed.length === 0) {
        setStatus("error");
        setMessage("No repositories found for this token.");
        return;
      }

      const parsedRepos = listedReposToRepoConfigs(listed);
      const { dateFrom, dateTo } = orgWideHistoryDateRange();
      const rangeCheck = validateWideDashboardDateRange(dateFrom, dateTo);
      if (!rangeCheck.ok) {
        setStatus("error");
        setMessage(rangeCheck.error);
        return;
      }

      const connectRes = await fetch(backendApiUrl("/api/github/connect"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), repos: parsedRepos }),
      });
      const connectData = await connectRes.json();

      if (!connectData.success) {
        setStatus("error");
        setMessage(connectData.error ?? "Connection failed");
        return;
      }

      setStatus("success");
      setMessage(`Loading ${parsedRepos.length} repos…`);
      onConnected({
        token: token.trim(),
        repos: parsedRepos,
        dateFrom,
        dateTo,
      });
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
  };

  const patLandingCard =
    "rounded-3xl bg-[#081257]/72 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/40 p-8 md:p-10 transition-all duration-300 ease-out hover:scale-[1.02] hover:border-white/15 hover:shadow-blue-500/15";

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className={patLandingCard}>
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 rounded-[16px] bg-gradient-to-br from-blue-950/45 to-blue-600/25 ring-1 ring-white/10">
            <GitBranch className="w-6 h-6 text-sky-300" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-semibold text-white tracking-tight">Connect with GitHub</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Enter your PAT — we&apos;ll load commit history from 2008 through today (up to thousands of
              commits per repo, GitHub data first). Use Analysis for a smaller AI window.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Personal Access Token</label>
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
              Needs <code className="text-gray-400">repo</code> scope. Pick repos and dates for AI on the{" "}
              <strong className="text-gray-400">Analysis</strong> page after load.
            </p>
          </div>

          <motion.button
            type="button"
            onClick={() => void handleOpenDashboard()}
            disabled={status === "loading"}
            whileHover={status === "loading" ? undefined : { scale: 1.02 }}
            whileTap={status === "loading" ? undefined : { scale: 0.98 }}
            className="w-full py-3 px-6 rounded-full font-semibold text-white flex items-center justify-center gap-2 bg-gradient-to-r from-blue-700 to-blue-500 shadow-lg shadow-blue-600/35 hover:shadow-blue-500/45 hover:from-blue-600 hover:to-sky-400 transition-all duration-300 disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:from-blue-700 disabled:hover:to-blue-500"
          >
            {status === "loading" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Opening dashboard…
              </>
            ) : (
              "Open dashboard"
            )}
          </motion.button>
        </div>

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
