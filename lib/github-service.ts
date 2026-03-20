import { Octokit } from "@octokit/rest";
import type {
  GitHubConfig,
  Contributor,
  CommitData,
  PullRequestData,
  IssueData,
  FileChange,
  RepositoryData,
} from "./types";

export class GitHubService {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(config: GitHubConfig) {
    this.octokit = new Octokit({ auth: config.token });
    this.owner = config.owner;
    this.repo = config.repo;
  }

  async validateConnection(): Promise<{ valid: boolean; user?: string }> {
    try {
      const { data } = await this.octokit.users.getAuthenticated();
      return { valid: true, user: data.login };
    } catch {
      return { valid: false };
    }
  }

  async fetchContributors(): Promise<Contributor[]> {
    const contributors: Contributor[] = [];
    let page = 1;

    while (true) {
      const { data } = await this.octokit.repos.listContributors({
        owner: this.owner,
        repo: this.repo,
        per_page: 100,
        page,
      });

      if (data.length === 0) break;

      for (const c of data) {
        if (c.login) {
          contributors.push({
            login: c.login,
            avatar_url: c.avatar_url ?? "",
            contributions: c.contributions ?? 0,
            html_url: c.html_url ?? "",
          });
        }
      }

      if (data.length < 100) break;
      page++;
    }

    return contributors;
  }

  async fetchCommits(since?: string): Promise<CommitData[]> {
    const commits: CommitData[] = [];
    let page = 1;
    const sinceDate = since ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    while (page <= 5) {
      const { data } = await this.octokit.repos.listCommits({
        owner: this.owner,
        repo: this.repo,
        since: sinceDate,
        per_page: 100,
        page,
      });

      if (data.length === 0) break;

      for (const commit of data) {
        let detail;
        try {
          const { data: d } = await this.octokit.repos.getCommit({
            owner: this.owner,
            repo: this.repo,
            ref: commit.sha,
          });
          detail = d;
        } catch {
          detail = null;
        }

        const files: FileChange[] =
          detail?.files?.map((f) => ({
            filename: f.filename ?? "",
            status: f.status ?? "modified",
            additions: f.additions ?? 0,
            deletions: f.deletions ?? 0,
            patch: f.patch?.substring(0, 500),
          })) ?? [];

        commits.push({
          sha: commit.sha,
          message: commit.commit.message,
          author: commit.author?.login ?? commit.commit.author?.name ?? "unknown",
          date: commit.commit.author?.date ?? "",
          filesChanged: detail?.files?.length ?? 0,
          additions: detail?.stats?.additions ?? 0,
          deletions: detail?.stats?.deletions ?? 0,
          files,
        });
      }

      if (data.length < 100) break;
      page++;
    }

    return commits;
  }

  async fetchPullRequests(state: "open" | "closed" | "all" = "all"): Promise<PullRequestData[]> {
    const prs: PullRequestData[] = [];
    let page = 1;

    while (page <= 5) {
      const { data } = await this.octokit.pulls.list({
        owner: this.owner,
        repo: this.repo,
        state,
        per_page: 100,
        page,
        sort: "updated",
        direction: "desc",
      });

      if (data.length === 0) break;

      for (const pr of data) {
        let detail;
        try {
          const { data: d } = await this.octokit.pulls.get({
            owner: this.owner,
            repo: this.repo,
            pull_number: pr.number,
          });
          detail = d;
        } catch {
          detail = null;
        }

        prs.push({
          number: pr.number,
          title: pr.title,
          state: pr.state,
          merged: detail?.merged ?? false,
          author: pr.user?.login ?? "unknown",
          created_at: pr.created_at,
          merged_at: detail?.merged_at ?? null,
          review_comments: detail?.review_comments ?? 0,
          additions: detail?.additions ?? 0,
          deletions: detail?.deletions ?? 0,
          changed_files: detail?.changed_files ?? 0,
          labels: pr.labels?.map((l) => (typeof l === "string" ? l : l.name ?? "")) ?? [],
        });
      }

      if (data.length < 100) break;
      page++;
    }

    return prs;
  }

  async fetchIssues(): Promise<IssueData[]> {
    const issues: IssueData[] = [];
    let page = 1;

    while (page <= 3) {
      const { data } = await this.octokit.issues.listForRepo({
        owner: this.owner,
        repo: this.repo,
        state: "all",
        per_page: 100,
        page,
        sort: "updated",
        direction: "desc",
      });

      if (data.length === 0) break;

      for (const issue of data) {
        if (issue.pull_request) continue;

        issues.push({
          number: issue.number,
          title: issue.title,
          state: issue.state as string,
          author: issue.user?.login ?? "unknown",
          labels: issue.labels?.map((l) => (typeof l === "string" ? l : l.name ?? "")) ?? [],
          created_at: issue.created_at,
          closed_at: issue.closed_at,
        });
      }

      if (data.length < 100) break;
      page++;
    }

    return issues;
  }

  async fetchAllData(): Promise<RepositoryData> {
    const [contributors, commits, pullRequests, issues] = await Promise.all([
      this.fetchContributors(),
      this.fetchCommits(),
      this.fetchPullRequests(),
      this.fetchIssues(),
    ]);

    return {
      owner: this.owner,
      repo: this.repo,
      contributors,
      commits,
      pullRequests,
      issues,
      fetchedAt: new Date().toISOString(),
    };
  }
}
