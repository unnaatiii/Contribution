export interface RepoConfig {
  owner: string;
  repo: string;
  label: string;
  repoType: "frontend" | "backend" | "erp";
}

export interface GitHubConfig {
  token: string;
  repos: RepoConfig[];
}

export interface CommitData {
  sha: string;
  message: string;
  author: string;
  date: string;
  repo: string;
  repoLabel: string;
  repoType: "frontend" | "backend" | "erp";
  filesChanged: string[];
  additions: number;
  deletions: number;
  diff: string;
  isMergeCommit: boolean;
}

export interface PullRequestData {
  number: number;
  title: string;
  body: string;
  state: string;
  merged: boolean;
  author: string;
  repo: string;
  repoLabel: string;
  created_at: string;
  merged_at: string | null;
}

export interface ReviewData {
  prNumber: number;
  prTitle: string;
  reviewer: string;
  repo: string;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED";
}

export type ContributionType = "feature" | "bug_fix" | "refactor" | "test" | "chore";
export type ImpactLevel = "low" | "medium" | "high" | "critical";
export type ContributorRole = "developer" | "manager";

export interface AICommitAnalysis {
  type: ContributionType;
  impact_level: ImpactLevel;
  business_impact_score: number;
  /** Narrative summary of what changed and evidence */
  reasoning: string;
  /** Dimensions explicitly weighed (e.g. "user submission path", "FE/BE contract") */
  parameters_considered?: string[];
  /** Why this exact score—not generic; tie number to parameters and evidence */
  score_justification?: string;
  /** Modules, routes, services, or user flows potentially affected */
  affected_modules_and_flows?: string[];
}

export interface AnalyzedCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  repo: string;
  repoLabel: string;
  repoType: "frontend" | "backend" | "erp";
  filesChanged: string[];
  isMergeCommit: boolean;
  analysis: AICommitAnalysis | null;
  modelUsed: string;
}

export interface DeveloperProfile {
  login: string;
  avatar_url: string;
  role: ContributorRole;
  totalCommits: number;
  meaningfulCommits: number;
  mergeCommits: number;
  reposContributed: string[];
  impactScore: number;
  avgBusinessImpact: number;
  commits: AnalyzedCommit[];
  breakdown: Record<ContributionType, number>;
  repoBreakdown: Record<string, { commits: number; score: number }>;
  totalReviews: number;
  prsApproved: number;
  insights: string[];
  tier: "exceptional" | "high" | "medium" | "growing";
}

export interface LeaderboardEntry {
  rank: number;
  developer: DeveloperProfile;
  badge?: string;
}

export interface MultiRepoData {
  repos: RepoConfig[];
  commits: CommitData[];
  pullRequests: PullRequestData[];
  reviews: ReviewData[];
  fetchedAt: string;
}

export interface AIAnalysisDiagnostics {
  openrouterConfigured: boolean;
  commitsEligible: number;
  commitsWithAnalysis: number;
  modelCallFailures: number;
  recentErrors: string[];
}

export interface AnalysisResult {
  repos: RepoConfig[];
  developers: DeveloperProfile[];
  leaderboard: LeaderboardEntry[];
  analyzedCommits: AnalyzedCommit[];
  topContributor: LeaderboardEntry | null;
  teamInsights: TeamInsight[];
  analyzedAt: string;
  aiPowered: boolean;
  modelsUsed: string[];
  commitCount: number;
  repoCount: number;
  aiDiagnostics?: AIAnalysisDiagnostics;
  /** Inclusive YYYY-MM-DD range used when fetching from GitHub */
  analysisWindow?: { from: string; to: string };
}

/** Client → analyze API: repos + optional OpenRouter override */
export interface AnalyzeImpactPayload {
  token: string;
  repos: RepoConfig[];
  dateFrom: string;
  dateTo: string;
  openrouterApiKey?: string;
}

export interface TeamInsight {
  category: string;
  title: string;
  description: string;
  developers: string[];
}
