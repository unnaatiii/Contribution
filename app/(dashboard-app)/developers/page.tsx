"use client";

import { useEffect, useMemo, useState } from "react";
import ContributorCard from "@/app/components/ContributorCard";
import { useAnalysisSession } from "@/components/AnalysisSessionProvider";
import {
  fingerprintForRepos,
  readCachedActiveCollaboratorLogins,
  readCachedGraphContributors,
  writeCachedActiveCollaboratorLogins,
  writeCachedGraphContributorLogins,
  type CachedGraphContributorRow,
} from "@/lib/active-contributors-cache";
import { developerProfileForGraphLogin, profileKeyMatchesContributorLogin } from "@/lib/commit-author";
import type { DeveloperProfile } from "@/lib/types";

type RangeMode = "active" | "lifetime";

function ToggleCount({ value }: { value: number | null }) {
  return (
    <span className="tabular-nums min-w-[1.5rem] text-right text-[11px] font-semibold text-zinc-400 group-hover:text-zinc-300">
      {value === null ? "—" : value}
    </span>
  );
}

function placeholderProfileFromGraphRow(m: CachedGraphContributorRow): DeveloperProfile {
  const login = m.login.trim();
  return {
    login,
    avatar_url: m.avatar_url?.trim() || `https://github.com/${login}.png`,
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
      `${m.contributions.toLocaleString()} all-time commit${m.contributions === 1 ? "" : "s"} on the default branch (GitHub). No rows in the current analysis window yet — widen the date range to see impact here.`,
    ],
    tier: "growing",
  };
}

function syntheticRowsFromLogins(logins: string[]): CachedGraphContributorRow[] {
  return [...logins]
    .map((login) => ({
      login,
      avatar_url: `https://github.com/${login}.png`,
      contributions: 0,
    }))
    .sort((a, b) => a.login.localeCompare(b.login));
}

export default function DevelopersPage() {
  const {
    result,
    dataResult,
    wideSnapshot,
    config,
    selectedDev,
    hoveredProfile,
    setHoveredProfile,
    displayMode,
  } = useAnalysisSession();

  const [rangeMode, setRangeMode] = useState<RangeMode>("active");

  const [graphMembers, setGraphMembers] = useState<CachedGraphContributorRow[]>([]);
  const [graphLoading, setGraphLoading] = useState(true);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [graphReady, setGraphReady] = useState(false);

  const [collabLoginSet, setCollabLoginSet] = useState<Set<string>>(() => new Set());
  const [collabLoading, setCollabLoading] = useState(true);
  const [collabError, setCollabError] = useState<string | null>(null);
  const [collabReady, setCollabReady] = useState(false);

  if (!result) return null;
  const view = dataResult ?? result;

  const reposForFetch = wideSnapshot?.config.repos ?? config?.repos ?? [];
  const token = wideSnapshot?.config.token ?? config?.token ?? "";
  const reposFingerprint = useMemo(
    () => fingerprintForRepos(reposForFetch),
    [wideSnapshot?.config, config],
  );

  useEffect(() => {
    const repos = wideSnapshot?.config.repos ?? config?.repos ?? [];
    const tok = wideSnapshot?.config.token ?? config?.token ?? "";

    if (!tok || repos.length === 0) {
      setGraphLoading(false);
      setGraphMembers([]);
      setGraphError(null);
      setGraphReady(false);
      return;
    }

    const cached = readCachedGraphContributors(repos);
    if (cached !== null) {
      const rows =
        cached.members && cached.members.length > 0
          ? cached.members
          : syntheticRowsFromLogins(cached.logins);
      setGraphMembers(rows);
      setGraphLoading(false);
      setGraphError(null);
      setGraphReady(true);
      return;
    }

    let cancelled = false;
    setGraphLoading(true);
    setGraphError(null);
    setGraphReady(false);

    void (async () => {
      try {
        const res = await fetch("/api/github/repo-contributors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: tok, repos }),
        });
        const data = (await res.json()) as {
          success?: boolean;
          error?: string;
          members?: { login: string; avatar_url?: string; contributions?: number }[];
        };
        if (cancelled) return;
        if (!res.ok || !data.success) {
          setGraphError(data.error ?? "Could not load GitHub contributors (graph).");
          setGraphMembers([]);
          setGraphReady(false);
          return;
        }
        const rows: CachedGraphContributorRow[] = (data.members ?? [])
          .map((m) => ({
            login: m.login?.trim() ?? "",
            avatar_url: (m.avatar_url?.trim() || `https://github.com/${m.login}.png`) ?? "",
            contributions: m.contributions ?? 0,
          }))
          .filter((m) => m.login.length > 0);
        const logins = rows.map((m) => m.login.toLowerCase());
        const next = new Set(logins);
        setGraphMembers(rows);
        setGraphReady(true);
        writeCachedGraphContributorLogins(repos, [...next], rows);
      } catch {
        if (!cancelled) {
          setGraphError("Could not load GitHub contributors (graph).");
          setGraphMembers([]);
          setGraphReady(false);
        }
      } finally {
        if (!cancelled) setGraphLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, reposFingerprint, wideSnapshot?.config, config]);

  useEffect(() => {
    const repos = wideSnapshot?.config.repos ?? config?.repos ?? [];
    const tok = wideSnapshot?.config.token ?? config?.token ?? "";

    if (!tok || repos.length === 0) {
      setCollabLoading(false);
      setCollabLoginSet(new Set());
      setCollabError(null);
      setCollabReady(false);
      return;
    }

    const cached = readCachedActiveCollaboratorLogins(repos);
    if (cached !== null) {
      setCollabLoginSet(new Set(cached));
      setCollabLoading(false);
      setCollabError(null);
      setCollabReady(true);
      return;
    }

    let cancelled = false;
    setCollabLoading(true);
    setCollabError(null);
    setCollabReady(false);

    void (async () => {
      try {
        const res = await fetch("/api/github/repo-collaborators", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: tok, repos }),
        });
        const data = (await res.json()) as {
          success?: boolean;
          error?: string;
          members?: { login: string }[];
        };
        if (cancelled) return;
        if (!res.ok || !data.success) {
          setCollabError(
            data.error ?? "Could not load repo collaborators (needs repo scope; admin may be required per repo).",
          );
          setCollabLoginSet(new Set());
          setCollabReady(false);
          return;
        }
        const logins = (data.members ?? [])
          .map((m) => m.login?.trim().toLowerCase())
          .filter((l): l is string => Boolean(l));
        const next = new Set(logins);
        setCollabLoginSet(next);
        setCollabReady(true);
        writeCachedActiveCollaboratorLogins(repos, [...next]);
      } catch {
        if (!cancelled) {
          setCollabError("Could not load repo collaborators");
          setCollabLoginSet(new Set());
          setCollabReady(false);
        }
      } finally {
        if (!cancelled) setCollabLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, reposFingerprint, wideSnapshot?.config, config]);

  const developers = view.developers;

  const lifetimeDevelopers = useMemo((): DeveloperProfile[] => {
    if (!graphReady || graphError || graphMembers.length === 0) {
      return developers;
    }
    const used = new Set<string>();
    const out: DeveloperProfile[] = [];

    for (const row of graphMembers) {
      const matched = developerProfileForGraphLogin(developers, row.login);
      if (matched) {
        const k = matched.login.toLowerCase();
        if (!used.has(k)) {
          out.push(matched as DeveloperProfile);
          used.add(k);
        }
      } else {
        out.push(placeholderProfileFromGraphRow(row));
        used.add(row.login.toLowerCase());
      }
    }

    for (const d of developers) {
      const k = d.login.toLowerCase();
      if (!used.has(k)) {
        out.push(d);
        used.add(k);
      }
    }

    return out;
  }, [developers, graphMembers, graphReady, graphError]);

  const filteredDevelopers = rangeMode === "active" ? developers : lifetimeDevelopers;

  const title =
    rangeMode === "active" ? "Contributors (current window)" : "All-time contributors (GitHub)";

  const showInactiveBadges =
    rangeMode === "lifetime" && !collabLoading && !collabError && collabReady;

  const toggleBtnBase =
    "group text-sm px-3 py-2 rounded-xl border transition-colors flex items-center justify-between gap-3 min-w-[10.5rem]";

  return (
    <div>
      {displayMode === "restored" ? (
        <p className="text-xs text-amber-200/85 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 mb-4">
          Developer cards and profiles use the <strong className="text-amber-100">saved analysis</strong>{" "}
          snapshot (same commit set as Commits / Insights for this run).
        </p>
      ) : null}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-semibold text-white mb-1">{title}</h2>
          {rangeMode === "active" && (
            <p className="text-xs text-zinc-500 max-w-xl">
              Everyone with commits in the <strong className="text-zinc-400">loaded analysis window</strong>{" "}
              (same basis as Insights and the Commits tab).
            </p>
          )}
          {rangeMode === "lifetime" && graphLoading && (
            <p className="text-xs text-amber-200/90">Loading all-time contributors from GitHub…</p>
          )}
          {rangeMode === "lifetime" && graphError && (
            <p className="text-xs text-amber-200/90">
              {graphError} — showing commit-derived profiles only until this succeeds.
            </p>
          )}
          {rangeMode === "lifetime" && !graphLoading && !graphError && (
            <p className="text-xs text-zinc-500 max-w-xl">
              Merged from GitHub <strong className="text-zinc-400">Insights → Contributors</strong>{" "}
              (default branch, all time) plus any identities that only appear in your synced commit history.
            </p>
          )}
          {wideSnapshot?.commitsDataSource === "database" && (
            <p className="text-xs text-zinc-500 max-w-xl mt-1">
              Commit-derived profiles use your synced database (refreshed from GitHub on each wide load).
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0 items-stretch sm:items-end">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRangeMode("active")}
              className={`${toggleBtnBase} ${
                rangeMode === "active"
                  ? "border-purple-400/50 bg-purple-500/20 text-white [&_span.tabular-nums]:text-zinc-200"
                  : "border-white/15 bg-white/5 text-zinc-300 hover:bg-white/10"
              }`}
            >
              <span>Active</span>
              <ToggleCount value={developers.length} />
            </button>
            <button
              type="button"
              onClick={() => setRangeMode("lifetime")}
              className={`${toggleBtnBase} ${
                rangeMode === "lifetime"
                  ? "border-purple-400/50 bg-purple-500/20 text-white [&_span.tabular-nums]:text-zinc-200"
                  : "border-white/15 bg-white/5 text-zinc-300 hover:bg-white/10"
              }`}
            >
              <span>Lifetime</span>
              <ToggleCount value={lifetimeDevelopers.length} />
            </button>
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-400 mb-6">
        Hover a card to focus it; others blur. Click to open full timeline and AI analysis.
      </p>

      {filteredDevelopers.length === 0 && (
        <p className="text-sm text-zinc-400 mb-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          No contributors to show. Widen the analysis date range or check repo selection.
        </p>
      )}

      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"
        onMouseLeave={() => setHoveredProfile(null)}
      >
        {filteredDevelopers.map((dev) => {
          const isCollabMember =
            collabError || !collabReady || profileKeyMatchesContributorLogin(dev.login, collabLoginSet);
          return (
            <ContributorCard
              key={dev.login}
              developer={dev}
              isSelected={selectedDev === dev.login}
              hoveredLogin={hoveredProfile}
              onHoverLogin={setHoveredProfile}
              inactive={showInactiveBadges && !isCollabMember}
            />
          );
        })}
      </div>
    </div>
  );
}
