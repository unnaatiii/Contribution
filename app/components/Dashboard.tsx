"use client";

import { useState, useCallback } from "react";
import {
  Activity,
  Loader2,
  RefreshCw,
  GitBranch,
  Clock,
  Users,
  GitCommit,
  GitPullRequest,
  AlertCircle,
} from "lucide-react";
import type { AnalysisResult } from "@/lib/types";
import Leaderboard from "./Leaderboard";
import ContributionCharts from "./ContributionCharts";
import ContributorCard from "./ContributorCard";
import TeamInsights from "./TeamInsights";
import ConnectForm from "./ConnectForm";

type Phase = "connect" | "fetching" | "analyzing" | "done" | "error";

export default function Dashboard() {
  const [phase, setPhase] = useState<Phase>("connect");
  const [config, setConfig] = useState<{ token: string; owner: string; repo: string } | null>(
    null,
  );
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [selectedDev, setSelectedDev] = useState<string | null>(null);
  const [progress, setProgress] = useState("");

  const runAnalysis = useCallback(
    async (cfg: { token: string; owner: string; repo: string }) => {
      setConfig(cfg);
      setPhase("fetching");
      setProgress("Fetching repository data from GitHub...");
      setError("");

      try {
        const fetchRes = await fetch("/api/github/fetch-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cfg),
        });
        const fetchData = await fetchRes.json();

        if (!fetchData.success) {
          throw new Error(fetchData.error);
        }

        setProgress(
          `Found ${fetchData.data.summary.contributors} contributors, ${fetchData.data.summary.commits} commits, ${fetchData.data.summary.pullRequests} PRs. Running AI analysis...`,
        );
        setPhase("analyzing");

        const analyzeRes = await fetch("/api/analyze-impact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cfg),
        });
        const analyzeData = await analyzeRes.json();

        if (!analyzeData.success) {
          throw new Error(analyzeData.error);
        }

        setResult(analyzeData.data);
        setPhase("done");
        if (analyzeData.data.developers.length > 0) {
          setSelectedDev(analyzeData.data.developers[0].login);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Analysis failed");
        setPhase("error");
      }
    },
    [],
  );

  const handleRefresh = () => {
    if (config) runAnalysis(config);
  };

  if (phase === "connect") {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col">
        <header className="border-b border-white/5 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <Activity className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">DevImpact AI</h1>
              <p className="text-xs text-zinc-500">AI-Powered Developer Contribution Analysis</p>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-lg">
            <div className="text-center mb-10">
              <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
                Measure Real Impact
              </h1>
              <p className="text-zinc-400 text-lg max-w-md mx-auto">
                Go beyond lines of code. AI analyzes your team&apos;s contributions by
                business value, complexity, and quality.
              </p>
            </div>
            <ConnectForm onConnected={runAnalysis} />

            <div className="mt-8 grid grid-cols-3 gap-4 max-w-lg mx-auto">
              {[
                { label: "AI Scoring", desc: "Not just LOC" },
                { label: "Impact ROI", desc: "Business value" },
                { label: "Team Insights", desc: "Hidden performers" },
              ].map((item) => (
                <div key={item.label} className="text-center p-3 bg-white/[0.02] rounded-xl border border-white/5">
                  <p className="text-sm font-medium text-zinc-300">{item.label}</p>
                  <p className="text-xs text-zinc-600 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (phase === "fetching" || phase === "analyzing") {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mx-auto mb-6" />
          <h2 className="text-xl font-semibold text-white mb-2">
            {phase === "fetching" ? "Fetching Repository Data" : "AI Analysis in Progress"}
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed">{progress}</p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"
                  style={{ animationDelay: `${i * 200}ms` }}
                />
              ))}
            </div>
            <span className="text-xs text-zinc-600">
              {phase === "fetching" ? "This may take 30-60 seconds" : "Analyzing with AI..."}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Analysis Failed</h2>
          <p className="text-sm text-red-400/80 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setPhase("connect")}
              className="px-5 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl text-sm hover:bg-white/10 transition-colors cursor-pointer"
            >
              Back to Setup
            </button>
            {config && (
              <button
                onClick={handleRefresh}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm hover:bg-indigo-500 transition-colors cursor-pointer"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5 px-6 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <Activity className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-white">DevImpact AI</h1>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <GitBranch className="w-3 h-3" />
                {result.repository.owner}/{result.repository.repo}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                {result.developers.length} developers
              </span>
              <span className="flex items-center gap-1.5">
                <GitCommit className="w-3.5 h-3.5" />
                {result.developers.reduce((s, d) => s + d.totalCommits, 0)} commits
              </span>
              <span className="flex items-center gap-1.5">
                <GitPullRequest className="w-3.5 h-3.5" />
                {result.developers.reduce((s, d) => s + d.totalPRs, 0)} PRs
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {new Date(result.analyzedAt).toLocaleDateString()}
              </span>
            </div>
            <button
              onClick={handleRefresh}
              className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              title="Re-run analysis"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPhase("connect")}
              className="text-xs px-3 py-1.5 text-zinc-400 hover:text-white border border-white/10 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              Switch Repo
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Left Column: Leaderboard + Insights */}
          <div className="xl:col-span-4 space-y-8">
            <Leaderboard entries={result.leaderboard} />
            <TeamInsights
              insights={result.teamInsights}
              sprintTop={result.sprintTopContributor}
            />
          </div>

          {/* Right Column: Charts + Cards */}
          <div className="xl:col-span-8 space-y-8">
            <ContributionCharts result={result} selectedDeveloper={selectedDev} />

            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Contributor Profiles</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.developers.map((dev) => (
                  <ContributorCard
                    key={dev.login}
                    developer={dev}
                    isSelected={selectedDev === dev.login}
                    onClick={() => setSelectedDev(dev.login)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
