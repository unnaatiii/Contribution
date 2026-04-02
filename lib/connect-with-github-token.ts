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

export type ListedRepo = {
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

/** Build RepoConfig for every repo returned by list-repos (used after PAT or OAuth). */
export function listedReposToRepoConfigs(listed: ListedRepo[]): RepoConfig[] {
  return listed.map((item) => ({
    owner: item.owner,
    repo: item.repo,
    label: item.repo,
    repoType: guessRepoType(item.repo),
  }));
}

export type ConnectWithGitHubTokenResult =
  | { ok: true; config: ConnectAnalysisConfig }
  | { ok: false; error: string };

/**
 * List repos via backend, validate wide date range, /connect, then return config for loadBaseData.
 */
export async function connectWithGitHubToken(rawToken: string): Promise<ConnectWithGitHubTokenResult> {
  const token = rawToken.trim();
  if (!token) {
    return { ok: false, error: "Missing GitHub token." };
  }

  try {
    const listRes = await fetch(backendApiUrl("/api/github/list-repos"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const listData = (await listRes.json()) as { success?: boolean; error?: string; repos?: ListedRepo[] };

    if (!listRes.ok || !listData.success) {
      return { ok: false, error: listData.error ?? "Could not list repositories" };
    }

    const listed = listData.repos ?? [];
    if (listed.length === 0) {
      return { ok: false, error: "No repositories found for this token." };
    }

    const parsedRepos = listedReposToRepoConfigs(listed);
    const { dateFrom, dateTo } = orgWideHistoryDateRange();
    const rangeCheck = validateWideDashboardDateRange(dateFrom, dateTo);
    if (!rangeCheck.ok) {
      return { ok: false, error: rangeCheck.error };
    }

    const connectRes = await fetch(backendApiUrl("/api/github/connect"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, repos: parsedRepos }),
    });
    const connectData = (await connectRes.json()) as { success?: boolean; error?: string };

    if (!connectData.success) {
      return { ok: false, error: connectData.error ?? "Connection failed" };
    }

    return {
      ok: true,
      config: {
        token,
        repos: parsedRepos,
        dateFrom,
        dateTo,
      },
    };
  } catch {
    return { ok: false, error: "Network error. Try again." };
  }
}
