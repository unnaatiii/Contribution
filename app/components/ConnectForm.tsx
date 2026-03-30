"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { GitBranch, Key, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  connectWithGitHubToken,
  type ConnectAnalysisConfig,
} from "@/lib/connect-with-github-token";

export type { ConnectAnalysisConfig } from "@/lib/connect-with-github-token";
export { listedReposToRepoConfigs, type ListedRepo } from "@/lib/connect-with-github-token";

interface ConnectFormProps {
  onConnected: (config: ConnectAnalysisConfig) => void;
  /** Purple neon landing card vs default blue connect card */
  variant?: "default" | "landing";
}

export default function ConnectForm({ onConnected, variant = "default" }: ConnectFormProps) {
  const landing = variant === "landing";
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

    const result = await connectWithGitHubToken(token);
    if (!result.ok) {
      setStatus("error");
      setMessage(result.error);
      return;
    }

    setStatus("success");
    setMessage(`Loading ${result.config.repos.length} repos…`);
    onConnected(result.config);
  };

  const cardClass = landing ?
      "rounded-[28px] bg-[#12051c]/90 backdrop-blur-xl border border-violet-500/45 shadow-[0_28px_90px_-24px_rgba(76,29,149,0.75)] ring-1 ring-fuchsia-500/20 p-8 md:p-10 transition-all duration-300 ease-out hover:border-violet-400/55 hover:shadow-[0_32px_100px_-20px_rgba(126,34,206,0.45)]"
    : "rounded-3xl bg-[#081257]/72 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/40 p-8 md:p-10 transition-all duration-300 ease-out hover:scale-[1.02] hover:border-white/15 hover:shadow-blue-500/15";

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className={cardClass}>
        <div className="flex items-center gap-3 mb-8">
          <div
            className={
              landing ?
                "p-2.5 rounded-[16px] bg-gradient-to-br from-violet-600/50 to-fuchsia-700/35 ring-1 ring-violet-300/25 shadow-lg shadow-violet-950/40"
              : "p-2.5 rounded-[16px] bg-gradient-to-br from-blue-950/45 to-blue-600/25 ring-1 ring-white/10"
            }
          >
            <GitBranch className={`w-6 h-6 ${landing ? "text-violet-100" : "text-sky-300"}`} />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-semibold text-white tracking-tight">Connect with GitHub</h2>
            <p className={`text-sm mt-0.5 ${landing ? "text-violet-200/75" : "text-gray-400"}`}>
              Sign in with GitHub or paste a PAT — we&apos;ll load commit history from 2008 through today (up
              to thousands of commits per repo, GitHub data first). Use Analysis for a smaller AI window.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <a
            href="/api/auth/github"
            className={
              landing ?
                "flex w-full items-center justify-center gap-2 py-3 px-6 rounded-full font-semibold text-white border border-violet-400/40 bg-violet-950/40 hover:bg-violet-900/50 hover:border-fuchsia-400/50 transition-all duration-300 text-sm shadow-inner shadow-black/20"
              : "flex w-full items-center justify-center gap-2 py-3 px-6 rounded-full font-semibold text-white border border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30 transition-all duration-300 text-sm"
            }
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            Continue with GitHub
          </a>

          <p className={`text-center text-xs ${landing ? "text-violet-300/55" : "text-zinc-500"}`}>
            or use a personal access token
          </p>

          <div>
            <label className={`block text-sm font-medium mb-2 ${landing ? "text-violet-100/90" : "text-gray-300"}`}>
              Personal Access Token
            </label>
            <div className="relative">
              <Key
                className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${landing ? "text-violet-400/80" : "text-zinc-400"}`}
              />
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className={
                  landing ?
                    "w-full pl-11 pr-4 py-3 bg-[#0a0412]/90 border border-violet-500/35 rounded-full text-violet-50 placeholder:text-violet-300/40 focus:outline-none focus:border-fuchsia-400/55 focus:ring-2 focus:ring-fuchsia-500/25 transition-all duration-300 text-sm"
                  : "w-full pl-11 pr-4 py-3 bg-white/10 border border-white/10 rounded-full text-white placeholder:text-gray-300 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all duration-300 text-sm"
                }
              />
            </div>
            <p className={`mt-1.5 text-xs ${landing ? "text-violet-300/50" : "text-gray-500"}`}>
              Needs <code className={landing ? "text-fuchsia-200/80" : "text-gray-400"}>repo</code> scope. Pick
              repos and dates for AI on the{" "}
              <strong className={landing ? "text-violet-100/90" : "text-gray-400"}>Analysis</strong> page after
              load.
            </p>
          </div>

          <motion.button
            type="button"
            onClick={() => void handleOpenDashboard()}
            disabled={status === "loading"}
            whileHover={status === "loading" ? undefined : { scale: 1.02 }}
            whileTap={status === "loading" ? undefined : { scale: 0.98 }}
            className={
              landing ?
                "w-full py-3 px-6 rounded-full font-semibold text-white flex items-center justify-center gap-2 bg-gradient-to-r from-violet-700 via-fuchsia-600 to-purple-600 shadow-lg shadow-violet-900/50 hover:shadow-fuchsia-500/30 hover:from-violet-600 hover:via-fuchsia-500 hover:to-purple-500 transition-all duration-300 disabled:opacity-45 disabled:cursor-not-allowed"
              : "w-full py-3 px-6 rounded-full font-semibold text-white flex items-center justify-center gap-2 bg-gradient-to-r from-blue-700 to-blue-500 shadow-lg shadow-blue-600/35 hover:shadow-blue-500/45 hover:from-blue-600 hover:to-sky-400 transition-all duration-300 disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:from-blue-700 disabled:hover:to-blue-500"
            }
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
