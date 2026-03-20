export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

export interface Contributor {
  login: string;
  avatar_url: string;
  contributions: number;
  html_url: string;
}

export interface CommitData {
  sha: string;
  message: string;
  author: string;
  date: string;
  filesChanged: number;
  additions: number;
  deletions: number;
  files: FileChange[];
}

export interface FileChange {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface PullRequestData {
  number: number;
  title: string;
  state: string;
  merged: boolean;
  author: string;
  created_at: string;
  merged_at: string | null;
  review_comments: number;
  additions: number;
  deletions: number;
  changed_files: number;
  labels: string[];
}

export interface IssueData {
  number: number;
  title: string;
  state: string;
  author: string;
  labels: string[];
  created_at: string;
  closed_at: string | null;
}

export type ContributionType =
  | "feature"
  | "bugfix"
  | "refactor"
  | "documentation"
  | "test"
  | "chore"
  | "performance"
  | "security";

export interface ContributionClassification {
  type: ContributionType;
  confidence: number;
  reasoning: string;
}

export interface ImpactAnalysis {
  impactScore: number;
  businessValue: number;
  complexity: number;
  codeQuality: number;
  classification: ContributionClassification;
  summary: string;
}

export interface DeveloperProfile {
  login: string;
  avatar_url: string;
  html_url: string;
  totalImpactScore: number;
  totalCommits: number;
  totalPRs: number;
  mergedPRs: number;
  prAcceptanceRate: number;
  totalIssues: number;
  contributionBreakdown: Record<ContributionType, number>;
  impactBreakdown: {
    businessValue: number;
    complexity: number;
    codeQuality: number;
    frequency: number;
  };
  weeklyScores: WeeklyScore[];
  insights: DeveloperInsight[];
  rank?: number;
  tier: "exceptional" | "high" | "medium" | "growing";
}

export interface WeeklyScore {
  week: string;
  score: number;
  commits: number;
  prs: number;
}

export interface DeveloperInsight {
  type: "strength" | "opportunity" | "highlight";
  message: string;
}

export interface LeaderboardEntry {
  rank: number;
  developer: DeveloperProfile;
  badge?: string;
}

export interface RepositoryData {
  owner: string;
  repo: string;
  contributors: Contributor[];
  commits: CommitData[];
  pullRequests: PullRequestData[];
  issues: IssueData[];
  fetchedAt: string;
}

export interface AnalysisResult {
  repository: { owner: string; repo: string };
  developers: DeveloperProfile[];
  leaderboard: LeaderboardEntry[];
  sprintTopContributor: LeaderboardEntry | null;
  teamInsights: TeamInsight[];
  analyzedAt: string;
}

export interface TeamInsight {
  category: string;
  title: string;
  description: string;
  developers: string[];
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
