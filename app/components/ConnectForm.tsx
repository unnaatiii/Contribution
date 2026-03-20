"use client";

import { useState } from "react";
import { GitBranch, Key, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface ConnectFormProps {
  onConnected: (config: { token: string; owner: string; repo: string }) => void;
}

export default function ConnectForm({ onConnected }: ConnectFormProps) {
  const [token, setToken] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const parseRepoUrl = (input: string): { owner: string; repo: string } | null => {
    const match = input.match(/(?:github\.com\/)?([^/]+)\/([^/\s]+)/);
    if (match) return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
    const parts = input.split("/").filter(Boolean);
    if (parts.length === 2) return { owner: parts[0], repo: parts[1] };
    return null;
  };

  const handleConnect = async () => {
    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
      setStatus("error");
      setMessage("Enter a valid repo (owner/repo or full GitHub URL)");
      return;
    }
    if (!token) {
      setStatus("error");
      setMessage("GitHub token is required");
      return;
    }

    setStatus("loading");
    setMessage("Connecting to GitHub...");

    try {
      const res = await fetch("/api/github/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...parsed }),
      });
      const data = await res.json();

      if (data.success) {
        setStatus("success");
        setMessage(data.data.message);
        onConnected({ token, ...parsed });
      } else {
        setStatus("error");
        setMessage(data.error);
      }
    } catch {
      setStatus("error");
      setMessage("Connection failed. Check your network and try again.");
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-indigo-500/20 rounded-xl">
            <GitBranch className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Connect Repository</h2>
            <p className="text-sm text-zinc-400">Link your GitHub repo to begin analysis</p>
          </div>
        </div>

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
                className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
              />
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">
              Needs <code className="text-zinc-400">repo</code> scope.{" "}
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Generate token
              </a>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Repository</label>
            <div className="relative">
              <GitBranch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="owner/repo or https://github.com/owner/repo"
                className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
              />
            </div>
          </div>

          <button
            onClick={handleConnect}
            disabled={status === "loading"}
            className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed text-sm"
          >
            {status === "loading" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting...
              </>
            ) : (
              "Connect & Analyze"
            )}
          </button>

          {message && (
            <div
              className={`flex items-start gap-2 p-3 rounded-xl text-sm ${
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
    </div>
  );
}
