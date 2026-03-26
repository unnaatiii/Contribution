"use client";

import { useState, useEffect, useCallback, startTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  GitCommit,
  FolderGit2,
  Eye,
  Brain,
  Sparkles,
  Bug,
  Wrench,
  FlaskConical,
  Settings,
  Shield,
  ChevronDown,
  ChevronUp,
  GitMerge,
} from "lucide-react";
import type { AnalysisResult, DeveloperProfile, AnalyzedCommit } from "@/lib/types";
import { SESSION_RESULT_KEY, SESSION_WIDE_BASE_KEY } from "@/lib/session-keys";
import { useAnalysisSession } from "@/components/AnalysisSessionProvider";
import {
  canonicalizeContributorKey,
  contributorAvatarUrl,
  contributorDisplayLabel,
  resolveProfileKey,
} from "@/lib/commit-author";
import { formatCommitDateTime } from "@/lib/format-commit-date";
import { useDeveloperTheme } from "@/hooks/useDeveloperTheme";
import {
  overlayExpandVariants,
  overlayTransition,
  readProfileTransition,
  clearProfileTransition,
  sectionReveal,
  type ProfileTransitionPayload,
} from "@/animations/profileTransition";

const typeColors: Record<string, string> = {
  feature: "text-purple-200 bg-purple-500/10 border-purple-500/25",
  bug_fix: "text-red-400 bg-red-500/10 border-red-500/20",
  refactor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  test: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  chore: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
};

const typeIcons: Record<string, React.ReactNode> = {
  feature: <Sparkles className="w-4 h-4" />,
  bug_fix: <Bug className="w-4 h-4" />,
  refactor: <Wrench className="w-4 h-4" />,
  test: <FlaskConical className="w-4 h-4" />,
  chore: <Settings className="w-4 h-4" />,
};

const impactColors: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10",
  high: "text-amber-400 bg-amber-500/10",
  medium: "text-purple-200 bg-purple-500/10",
  low: "text-zinc-400 bg-zinc-500/10",
};

function emptyShellDeveloper(login: string): DeveloperProfile {
  return {
    login,
    avatar_url: contributorAvatarUrl(login),
    role: "developer",
    totalCommits: 0,
    meaningfulCommits: 0,
    mergeCommits: 0,
    reposContributed: [],
    impactScore: 0,
    avgBusinessImpact: 0,
    commits: [],
    breakdown: { feature: 0, bug_fix: 0, refactor: 0, test: 0, chore: 0 },
    repoBreakdown: {},
    totalReviews: 0,
    prsApproved: 0,
    insights: [
      "No commits for this login in the current analysis window. Run a wider date range or sync repos if you expected activity here.",
    ],
    tier: "growing",
  };
}

function findDeveloperRow(r: AnalysisResult, slug: string): DeveloperProfile | undefined {
  const s = slug.trim().toLowerCase();
  const direct = r.developers.find((d) => d.login.toLowerCase() === s);
  if (direct) return direct;
  const canon = canonicalizeContributorKey(s);
  return r.developers.find((d) => d.login.toLowerCase() === canon.toLowerCase());
}

function commitTimelineKey(c: AnalyzedCommit): string {
  return `${c.repoLabel}:${c.sha}`;
}

function ProfileSection({
  children,
  className = "",
  revealOnScroll = true,
}: {
  children: React.ReactNode;
  className?: string;
  /** When false, section is visible immediately (avoids timeline staying off-screen until scroll). */
  revealOnScroll?: boolean;
}) {
  if (!revealOnScroll) {
    return <section className={className}>{children}</section>;
  }
  return (
    <motion.section
      className={className}
      variants={sectionReveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "0px 0px -80px 0px", amount: 0.05 }}
    >
      {children}
    </motion.section>
  );
}

function ProfileSkeleton({ theme }: { theme: { primary: string } }) {
  return (
    <div className="min-h-screen p-6 space-y-6 animate-pulse">
      <div
        className="h-14 w-40 rounded-2xl bg-white/5"
        style={{ boxShadow: `0 0 40px ${theme.primary}22` }}
      />
      <div className="flex gap-4">
        <div className="w-24 h-24 rounded-3xl bg-white/10" />
        <div className="flex-1 space-y-3">
          <div className="h-8 bg-white/10 rounded-lg w-1/3" />
          <div className="h-4 bg-white/5 rounded w-1/2" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 rounded-[20px] bg-white/5 border border-white/10" />
        ))}
      </div>
      <div className="h-64 rounded-[20px] bg-white/5 border border-white/10" />
    </div>
  );
}

export default function DeveloperProfile({ devName }: { devName: string }) {
  const theme = useDeveloperTheme(devName);
  const router = useRouter();
  const { dataResult, result, bootstrapped } = useAnalysisSession();
  const [developer, setDeveloper] = useState<DeveloperProfile | null>(null);
  const [hasAiEnhancement, setHasAiEnhancement] = useState(false);
  const [commits, setCommits] = useState<AnalyzedCommit[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSha, setExpandedSha] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<"all" | "analyzed">("all");
  const [gate, setGate] = useState<"pending" | "expand" | "ready">("pending");
  const [payload, setPayload] = useState<ProfileTransitionPayload | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const p = readProfileTransition(devName);
    setPayload(p);
    setGate(p ? "expand" : "ready");
  }, [devName]);

  useEffect(() => {
    setTimelineFilter("all");
    setExpandedSha(null);
  }, [devName]);

  useEffect(() => {
    const applyResult = (r: AnalysisResult) => {
      const dev = findDeveloperRow(r, devName);
      const ai =
        r.hasAiEnhancement ?? r.analyzedCommits.some((c) => c.analysis && !c.isMergeCommit);
      startTransition(() => {
        if (dev) {
          setDeveloper(dev);
          setHasAiEnhancement(!!ai);
          const timeline =
            dev.commits.length > 0
              ? dev.commits
              : r.analyzedCommits.filter(
                  (c) =>
                    resolveProfileKey(c.author, c.authorEmail).toLowerCase() === dev.login.toLowerCase(),
                );
          setCommits(timeline);
        } else {
          const fromCommits = r.analyzedCommits.filter(
            (c) => resolveProfileKey(c.author, c.authorEmail).toLowerCase() === devName.toLowerCase(),
          );
          const shell = emptyShellDeveloper(devName);
          if (fromCommits.length > 0) {
            shell.commits = fromCommits;
            shell.totalCommits = fromCommits.length;
            shell.meaningfulCommits = fromCommits.filter((c) => !c.isMergeCommit).length;
            shell.mergeCommits = fromCommits.filter((c) => c.isMergeCommit).length;
            shell.insights = [];
          }
          setDeveloper(shell);
          setHasAiEnhancement(!!ai);
          setCommits(fromCommits);
        }
        setLoading(false);
      });
    };

    const view = dataResult ?? result;
    if (view) {
      applyResult(view);
      return;
    }

    if (!bootstrapped) return;

    const run = () => {
      const wideRaw = sessionStorage.getItem(SESSION_WIDE_BASE_KEY);
      let stored: string | null = null;
      if (wideRaw) {
        try {
          const o = JSON.parse(wideRaw) as { result?: AnalysisResult };
          if (o?.result) stored = JSON.stringify(o.result);
        } catch {
          /* ignore */
        }
      }
      if (!stored) stored = sessionStorage.getItem(SESSION_RESULT_KEY);
      if (!stored) {
        startTransition(() => setLoading(false));
        return;
      }
      try {
        applyResult(JSON.parse(stored) as AnalysisResult);
      } catch {
        startTransition(() => setLoading(false));
      }
    };
    const id = requestAnimationFrame(() => run());
    return () => cancelAnimationFrame(id);
  }, [devName, dataResult, result, bootstrapped]);

  const handleBack = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => router.push("/developers"), 380);
  }, [router]);

  const onExpandComplete = useCallback(() => {
    clearProfileTransition();
    setGate("ready");
  }, []);

  if (gate === "pending") {
    return <ProfileSkeleton theme={theme} />;
  }

  if (!loading && !developer && gate === "ready") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[20px] bg-white/5 backdrop-blur-xl border border-white/10 p-10 text-center max-w-md shadow-2xl"
        >
          <h2 className="text-2xl font-semibold text-white mb-2">Developer not found</h2>
          <p className="text-gray-400 mb-6 text-sm">
            Run an analysis first, then open a profile from the dashboard.
          </p>
          <Link
            href="/developers"
            className="inline-flex px-6 py-3 rounded-full font-medium text-sm text-white shadow-lg transition-all bg-white/10 border border-white/15 hover:bg-white/15"
          >
            Back to developers
          </Link>
        </motion.div>
      </div>
    );
  }

  const showLoadingReady = loading && !developer && gate === "ready";

  if (showLoadingReady) {
    return (
      <div className="min-h-screen relative" style={{ background: "#020617" }}>
        <div
          className="pointer-events-none fixed inset-0 -z-10"
          style={{
            background: `#020617`,
            backgroundImage: `${theme.gradientCss}, radial-gradient(ellipse 120% 70% at 50% -20%, ${theme.glow}, transparent 55%)`,
          }}
        />
        <ProfileSkeleton theme={theme} />
      </div>
    );
  }

  if (!developer) {
    return (
      <div className="min-h-screen relative" style={{ background: "#020617" }}>
        <AnimatePresence>
          {gate === "expand" && payload && (
            <motion.div
              key="expand-shell"
              className="fixed overflow-hidden shadow-2xl"
              style={{
                zIndex: 200,
                background: `linear-gradient(135deg, color-mix(in srgb, ${payload.primary} 35%, #020617), #020617)`,
                pointerEvents: "none",
              }}
              custom={payload}
              variants={overlayExpandVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={overlayTransition}
              onAnimationComplete={onExpandComplete}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  const timelineAll = [...commits].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const analyzedInTimeline = timelineAll.filter((c) => c.analysis);
  const displayCommits =
    timelineFilter === "analyzed"
      ? [...analyzedInTimeline].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      : timelineAll;
  const repoEntries = Object.entries(developer.repoBreakdown).sort(([, a], [, b]) => b.score - a.score);
  const featureCommits = timelineAll.filter((c) => !c.isMergeCommit && c.analysis?.type === "feature");

  return (
    <motion.div
      className="min-h-screen relative"
      animate={leaving ? { opacity: 0, y: 14 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      style={
        {
          ["--dev-primary" as string]: theme.primary,
          ["--dev-secondary" as string]: theme.secondary,
          ["--dev-glow" as string]: theme.glow,
        } as React.CSSProperties
      }
    >
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background: `#020617`,
          backgroundImage: `${theme.gradientCss}, radial-gradient(ellipse 120% 70% at 50% -20%, var(--dev-glow), transparent 55%)`,
        }}
      />

      <AnimatePresence>
        {gate === "expand" && payload && (
          <motion.div
            key="expand-shell"
            className="fixed overflow-hidden shadow-2xl"
            style={{
              zIndex: 200,
              background: `linear-gradient(135deg, color-mix(in srgb, ${payload.primary} 35%, #020617), #020617)`,
              pointerEvents: "none",
            }}
            custom={payload}
            variants={overlayExpandVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={overlayTransition}
            onAnimationComplete={onExpandComplete}
          />
        )}
      </AnimatePresence>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#020617]/70 backdrop-blur-xl px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <motion.button
            type="button"
            onClick={handleBack}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 p-2.5 pr-4 text-gray-300 hover:text-white rounded-[14px] bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 shrink-0" />
            <span className="hidden sm:inline">Back</span>
          </motion.button>
          <motion.img
            layoutId={`developer-avatar-${developer.login}`}
            src={developer.avatar_url}
            alt={contributorDisplayLabel(developer.login)}
            className="w-12 h-12 rounded-2xl ring-2 ring-white/10 object-cover shadow-lg"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold text-white tracking-tight truncate">
                {contributorDisplayLabel(developer.login)}
              </h1>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                  developer.role === "manager"
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-emerald-500/20 text-emerald-400"
                }`}
              >
                {developer.role}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1 truncate">
              {developer.reposContributed.length > 0
                ? `${developer.reposContributed.join(", ")} · `
                : ""}
              {timelineAll.length} commit{timelineAll.length === 1 ? "" : "s"} in window
              {analyzedInTimeline.length > 0
                ? ` · ${analyzedInTimeline.length} with AI analysis`
                : ""}
            </p>
          </div>
          <div className="ml-auto text-right hidden sm:block">
            <p
              className="text-2xl font-bold tabular-nums text-transparent bg-clip-text"
              style={{
                backgroundImage: `linear-gradient(90deg, ${theme.primary}, ${theme.secondary})`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
              }}
            >
              {hasAiEnhancement ? developer.impactScore : "—"}
            </p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Impact</p>
          </div>
        </div>
      </header>

      {gate === "ready" && (
        <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="relative rounded-[28px] overflow-hidden border border-white/10 p-8 md:p-10 bg-white/[0.04] backdrop-blur-xl"
            style={{
              boxShadow: `0 0 80px -20px ${theme.glow}`,
            }}
          >
            <div
              className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl opacity-40 pointer-events-none"
              style={{ background: theme.primary }}
            />
            <div className="relative flex flex-col md:flex-row md:items-center gap-6">
              <img
                src={developer.avatar_url}
                alt=""
                className="w-24 h-24 md:w-28 md:h-28 rounded-3xl ring-2 ring-white/15 object-cover shadow-xl"
              />
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-white tracking-tight">
                  {contributorDisplayLabel(developer.login)}
                </h2>
                <p className="text-sm text-gray-400 mt-1 capitalize">{developer.role}</p>
                <div
                  className="mt-4 inline-flex items-baseline gap-2 px-4 py-2 rounded-2xl border border-white/10 bg-black/20"
                  style={{ borderColor: `${theme.primary}44` }}
                >
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Impact score</span>
                  <span className="text-3xl font-bold tabular-nums text-white">
                    {hasAiEnhancement ? developer.impactScore : "—"}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          <ProfileSection>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                {
                  label: "Impact Score",
                  value: hasAiEnhancement ? developer.impactScore : "—",
                  icon: <Shield className="w-4 h-4" style={{ color: theme.primary }} />,
                },
                {
                  label: "Commits (window)",
                  value: developer.totalCommits,
                  icon: <GitCommit className="w-4 h-4 text-blue-400" />,
                },
                {
                  label: "Repos",
                  value: developer.reposContributed.length,
                  icon: <FolderGit2 className="w-4 h-4 text-cyan-400" />,
                },
                {
                  label: "Reviews",
                  value: developer.totalReviews,
                  icon: <Eye className="w-4 h-4 text-sky-400" />,
                },
                {
                  label: "Avg Impact",
                  value: hasAiEnhancement ? `${developer.avgBusinessImpact}/100` : "—",
                  icon: <Brain className="w-4 h-4 text-emerald-400" />,
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-[20px] bg-white/5 backdrop-blur-xl border border-white/10 p-5 transition-all duration-300 hover:border-white/15 hover:bg-white/[0.07]"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {stat.icon}
                    <span className="text-xs text-gray-400">{stat.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-white tabular-nums">{stat.value}</p>
                </div>
              ))}
            </div>
          </ProfileSection>

          {hasAiEnhancement && (
            <ProfileSection>
              <p className="text-sm text-zinc-400 max-w-3xl leading-relaxed">
                <span className="text-zinc-300 font-medium">Impact score</span> matches the Insights
                leaderboard: each AI-scored commit contributes by type, impact level, repo weight, and
                business score (not a simple average). Open any commit in the timeline below for the model’s{" "}
                <em className="text-zinc-300">why this score</em> narrative and evidence.
              </p>
            </ProfileSection>
          )}

          <ProfileSection className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-[20px] bg-white/5 backdrop-blur-xl border border-white/10 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Contribution Breakdown</h3>
              <div className="space-y-3">
                {Object.entries(developer.breakdown)
                  .filter(([, v]) => v > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => {
                    const total = developer.meaningfulCommits || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="flex items-center gap-2 text-gray-200">
                            {typeIcons[type]}
                            {type}
                          </span>
                          <span className="text-gray-400">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{
                              background: `linear-gradient(90deg, ${theme.primary}, ${theme.secondary})`,
                            }}
                            initial={{ width: 0 }}
                            whileInView={{ width: `${pct}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="rounded-[20px] bg-white/5 backdrop-blur-xl border border-white/10 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Repo-wise Contribution</h3>
              <div className="space-y-4">
                {repoEntries.map(([repo, data]) => (
                  <div key={repo} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white font-medium">{repo}</p>
                      <p className="text-xs text-gray-500">{data.commits} commits</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold tabular-nums" style={{ color: theme.primary }}>
                        {Math.round(data.score)}
                      </p>
                      <p className="text-[10px] text-gray-500">score</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ProfileSection>

          {featureCommits.length > 0 && (
            <ProfileSection>
              <div className="rounded-[20px] bg-white/5 backdrop-blur-xl border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: theme.primary }} />
                  Features Worked On ({featureCommits.length})
                </h3>
                <div className="space-y-2">
                  {featureCommits.map((c) => (
                    <div
                      key={commitTimelineKey(c)}
                      className="flex items-start gap-3 p-4 bg-white/[0.04] rounded-[14px] border border-white/5 hover:border-white/10 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-mono">{c.message.split("\n")[0]}</p>
                        <p className="text-xs text-zinc-500 mt-1 tabular-nums">
                          {formatCommitDateTime(c.date)} · {c.repoLabel} · {c.sha.substring(0, 7)}
                        </p>
                      </div>
                      {c.analysis && (
                        <span className="text-xs font-bold shrink-0 tabular-nums" style={{ color: theme.secondary }}>
                          {c.analysis.business_impact_score}/100
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </ProfileSection>
          )}

          {developer.insights.length > 0 && (
            <ProfileSection>
              <div className="rounded-[20px] bg-white/5 backdrop-blur-xl border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-3">AI Insights</h3>
                <div className="space-y-2">
                  {developer.insights.map((insight, i) => (
                    <p key={i} className="text-sm text-gray-400 leading-relaxed">
                      {insight}
                    </p>
                  ))}
                </div>
              </div>
            </ProfileSection>
          )}

          <ProfileSection revealOnScroll={false}>
            <h3 className="text-2xl font-semibold text-white mb-2 flex items-center gap-2">
              <GitCommit className="w-6 h-6 text-blue-400" />
              Contribution timeline
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Newest first. Every commit in the current window is listed; AI narrative appears on analyzed
              commits after you run analysis.
            </p>

            <div className="flex flex-wrap gap-2 mb-6">
              <button
                type="button"
                onClick={() => setTimelineFilter("all")}
                className={`text-xs px-3 py-2 rounded-xl border transition-colors cursor-pointer ${
                  timelineFilter === "all"
                    ? "border-blue-400/50 bg-blue-500/15 text-blue-100"
                    : "border-white/15 bg-white/5 text-zinc-400 hover:bg-white/10"
                }`}
              >
                All commits ({timelineAll.length})
              </button>
              <button
                type="button"
                onClick={() => setTimelineFilter("analyzed")}
                className={`text-xs px-3 py-2 rounded-xl border transition-colors cursor-pointer ${
                  timelineFilter === "analyzed"
                    ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
                    : "border-white/15 bg-white/5 text-zinc-400 hover:bg-white/10"
                }`}
              >
                Analyzed ({analyzedInTimeline.length})
              </button>
            </div>

            <div className="relative pl-2">
              <div
                className="absolute left-[11px] top-2 bottom-2 w-px opacity-60"
                style={{
                  background: `linear-gradient(to bottom, ${theme.primary}, transparent)`,
                }}
              />
              <div className="space-y-4">
                {displayCommits.length === 0 && (
                  <p className="text-sm text-zinc-500 pl-8">
                    {timelineFilter === "analyzed"
                      ? "No analyzed commits in this window yet. Switch to “All commits” or run AI analysis."
                      : "No commits in this window for this profile."}
                  </p>
                )}
                {displayCommits.map((commit) => {
                  const rowKey = commitTimelineKey(commit);
                  const expanded = expandedSha === rowKey;
                  const hasAnalysis = !!commit.analysis;
                  return (
                    <div key={rowKey} className="relative pl-8">
                      <div
                        className={`absolute left-0 top-3 w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center z-10 ${
                          commit.isMergeCommit
                            ? "border-amber-500/40 bg-zinc-900 text-amber-400"
                            : "bg-slate-950 text-zinc-200"
                        }`}
                        style={
                          !commit.isMergeCommit
                            ? { borderColor: `${theme.primary}88` }
                            : undefined
                        }
                      >
                        {commit.isMergeCommit ? (
                          <GitMerge className="w-3 h-3" />
                        ) : (
                          <GitCommit className="w-3 h-3" />
                        )}
                      </div>

                      <div className="rounded-xl overflow-hidden bg-white/5 border border-white/10 backdrop-blur-md">
                        <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <time
                                className="text-xs font-medium tabular-nums text-gray-300"
                                dateTime={commit.date}
                              >
                                {formatCommitDateTime(commit.date)}
                              </time>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-400">
                                {commit.repoLabel}
                              </span>
                              {commit.isMergeCommit && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                                  Merge commit
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-white font-mono leading-snug break-words">
                              {commit.message.split("\n")[0]}
                            </p>
                            <p className="text-[10px] text-zinc-600 font-mono mt-1">{commit.sha}</p>
                          </div>
                          {!commit.isMergeCommit && (
                            <button
                              type="button"
                              onClick={() => setExpandedSha(expanded ? null : rowKey)}
                              className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-white/15 hover:bg-white/5 transition-colors cursor-pointer self-start"
                              style={{ color: theme.primary }}
                            >
                              {expanded ? (
                                <>
                                  <ChevronUp className="w-4 h-4" />
                                  Collapse
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-4 h-4" />
                                  {hasAnalysis ? "Full analysis" : "Details"}
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {hasAnalysis && !expanded && (
                          <div className="px-4 pb-3 -mt-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`text-[11px] px-2 py-0.5 rounded-full border ${typeColors[commit.analysis!.type] ?? typeColors.chore}`}
                              >
                                {commit.analysis!.type}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full ${impactColors[commit.analysis!.impact_level] ?? impactColors.medium}`}
                              >
                                {commit.analysis!.impact_level}
                              </span>
                              <span className="text-xs font-bold tabular-nums" style={{ color: theme.secondary }}>
                                {commit.analysis!.business_impact_score}/100
                              </span>
                            </div>
                            <p className="text-xs text-zinc-500 mt-2 line-clamp-2">
                              {commit.analysis!.score_justification ?? commit.analysis!.reasoning}
                            </p>
                          </div>
                        )}

                        {expanded && !commit.isMergeCommit && (
                          <div className="border-t border-white/10 bg-zinc-900/40 p-4 space-y-4">
                            <div>
                              <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">
                                Full commit message
                              </p>
                              <p className="text-sm text-zinc-200 font-mono whitespace-pre-wrap break-words">
                                {commit.message}
                              </p>
                            </div>
                            {commit.filesChanged.length > 0 && (
                              <div>
                                <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">
                                  Files changed ({commit.filesChanged.length})
                                </p>
                                <ul className="text-xs text-zinc-400 font-mono max-h-40 overflow-y-auto space-y-0.5">
                                  {commit.filesChanged.map((f) => (
                                    <li key={f}>{f}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {hasAnalysis ? (
                              <>
                                <div>
                                  <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">
                                    Summary
                                  </p>
                                  <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                                    {commit.analysis!.reasoning}
                                  </p>
                                </div>
                                <div>
                                  <p
                                    className="text-[11px] uppercase tracking-wider mb-1"
                                    style={{ color: theme.primary }}
                                  >
                                    Why this score ({commit.analysis!.business_impact_score}/100)
                                  </p>
                                  <p
                                    className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap border-l-2 pl-3"
                                    style={{ borderColor: `${theme.primary}66` }}
                                  >
                                    {commit.analysis!.score_justification ?? commit.analysis!.reasoning}
                                  </p>
                                </div>
                                {(commit.analysis!.parameters_considered?.length ?? 0) > 0 && (
                                  <div>
                                    <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">
                                      Parameters considered
                                    </p>
                                    <ul className="text-sm text-zinc-400 list-disc list-inside space-y-0.5">
                                      {(commit.analysis!.parameters_considered ?? []).map((p, i) => (
                                        <li key={i}>{p}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {(commit.analysis!.affected_modules_and_flows?.length ?? 0) > 0 && (
                                  <div>
                                    <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">
                                      Modules &amp; flows impacted
                                    </p>
                                    <ul className="text-sm text-amber-200/80 list-disc list-inside space-y-0.5">
                                      {(commit.analysis!.affected_modules_and_flows ?? []).map((p, i) => (
                                        <li key={i}>{p}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                <p className="text-[11px] text-zinc-600">
                                  Model: {commit.modelUsed} · {formatCommitDateTime(commit.date)}
                                </p>
                              </>
                            ) : (
                              <p className="text-sm text-zinc-500">
                                No AI layer for this commit yet. Use <strong className="text-zinc-400">Run AI analysis</strong>{" "}
                                on the dashboard.
                              </p>
                            )}
                          </div>
                        )}

                        {commit.isMergeCommit && !hasAnalysis && (
                          <div className="px-4 pb-3 text-xs text-zinc-500">
                            Merge commits are not AI-scored; shown for timeline completeness.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ProfileSection>
        </main>
      )}
    </motion.div>
  );
}
