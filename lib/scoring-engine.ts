import type {
  MultiRepoData,
  AnalyzedCommit,
  DeveloperProfile,
  LeaderboardEntry,
  TeamInsight,
  AnalysisResult,
  ContributionType,
  ContributorRole,
  RepoConfig,
} from "./types";
import { AIAnalyzer } from "./ai-analyzer";

const TYPE_WEIGHTS: Record<ContributionType, number> = {
  feature: 10,
  bug_fix: 8,
  refactor: 6,
  test: 5,
  chore: 2,
};

const IMPACT_MULTIPLIER: Record<string, number> = {
  critical: 4.0,
  high: 2.5,
  medium: 1.5,
  low: 1.0,
};

const REPO_WEIGHT: Record<string, number> = {
  frontend: 1.2,
  backend: 1.5,
  erp: 1.1,
};

const MANAGER_LOGIN = "abhishekpandey";

export class ScoringEngine {
  private analyzer: AIAnalyzer;

  constructor(openrouterApiKey?: string) {
    this.analyzer = new AIAnalyzer(openrouterApiKey);
  }

  async analyzeMultiRepo(data: MultiRepoData): Promise<AnalysisResult> {
    console.log(`[Engine] Starting analysis of ${data.commits.length} commits across ${data.repos.length} repos`);

    const analyzedCommits = await this.analyzer.analyzeAllCommits(data.commits);
    const profiles = this.buildProfiles(analyzedCommits, data);
    const leaderboard = this.buildLeaderboard(profiles);
    const teamInsights = this.generateTeamInsights(profiles, data.repos);

    return {
      repos: data.repos,
      developers: profiles,
      leaderboard,
      analyzedCommits,
      topContributor: leaderboard[0] ?? null,
      teamInsights,
      analyzedAt: new Date().toISOString(),
      aiPowered: this.analyzer.isAIPowered,
      modelsUsed: this.analyzer.modelNames,
      commitCount: analyzedCommits.length,
      repoCount: data.repos.length,
      aiDiagnostics: this.analyzer.lastBatchDiagnostics,
    };
  }

  private buildProfiles(
    analyzedCommits: AnalyzedCommit[],
    data: MultiRepoData,
  ): DeveloperProfile[] {
    const devMap = new Map<string, DeveloperProfile>();

    const ensureProfile = (login: string): DeveloperProfile => {
      if (!devMap.has(login)) {
        devMap.set(login, {
          login,
          avatar_url: `https://github.com/${login}.png`,
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
          insights: [],
          tier: "growing",
        });
      }
      return devMap.get(login)!;
    };

    for (const commit of analyzedCommits) {
      const dev = ensureProfile(commit.author);
      dev.totalCommits++;
      dev.commits.push(commit);

      if (commit.isMergeCommit) {
        dev.mergeCommits++;
        continue;
      }

      dev.meaningfulCommits++;

      if (!dev.reposContributed.includes(commit.repoLabel)) {
        dev.reposContributed.push(commit.repoLabel);
      }

      if (!dev.repoBreakdown[commit.repoLabel]) {
        dev.repoBreakdown[commit.repoLabel] = { commits: 0, score: 0 };
      }
      dev.repoBreakdown[commit.repoLabel].commits++;

      if (commit.analysis) {
        const { type, impact_level, business_impact_score } = commit.analysis;
        dev.breakdown[type]++;

        const repoW = REPO_WEIGHT[commit.repoType] ?? 1.0;
        const typeW = TYPE_WEIGHTS[type] ?? 2;
        const impactM = IMPACT_MULTIPLIER[impact_level] ?? 1.0;

        const commitScore = typeW * impactM * repoW + business_impact_score * 0.3;
        dev.impactScore += commitScore;
        dev.repoBreakdown[commit.repoLabel].score += commitScore;
      }
    }

    for (const review of data.reviews) {
      const dev = ensureProfile(review.reviewer);
      dev.totalReviews++;
      if (review.state === "APPROVED") dev.prsApproved++;
    }

    for (const dev of devMap.values()) {
      if (dev.login.toLowerCase() === MANAGER_LOGIN.toLowerCase()) {
        dev.role = "manager";
        dev.impactScore = Math.round(dev.impactScore * 0.2);
      }

      const hasMeaningful = dev.meaningfulCommits;
      const analyzedWithScore = dev.commits.filter((c) => c.analysis && !c.isMergeCommit);
      if (analyzedWithScore.length > 0) {
        dev.avgBusinessImpact = Math.round(
          analyzedWithScore.reduce((s, c) => s + (c.analysis?.business_impact_score ?? 0), 0) / analyzedWithScore.length,
        );
      }

      dev.impactScore = Math.round(dev.impactScore);
      dev.tier = this.assignTier(dev);
      dev.insights = this.generateInsights(dev);
    }

    return Array.from(devMap.values()).sort((a, b) => b.impactScore - a.impactScore);
  }

  private assignTier(dev: DeveloperProfile): DeveloperProfile["tier"] {
    if (dev.role === "manager") return "medium";
    if (dev.impactScore > 300 && dev.avgBusinessImpact > 60) return "exceptional";
    if (dev.impactScore > 150) return "high";
    if (dev.impactScore > 50) return "medium";
    return "growing";
  }

  private generateInsights(dev: DeveloperProfile): string[] {
    const insights: string[] = [];

    if (dev.role === "manager") {
      insights.push(`Manager role — ${dev.totalReviews} reviews, ${dev.prsApproved} approvals, ${dev.mergeCommits} merges`);
      return insights;
    }

    insights.push(
      "How impact works: each scored commit adds (change-type weight × impact-level multiplier × repo-role weight) + 30% of the AI business score (1–100). Total impact is the sum — not raw commit count. Frontend work can rank high when it fixes user flows, API contracts, uploads, or integrations.",
    );

    const analyzedCount = dev.commits.filter((c) => c.analysis && !c.isMergeCommit).length;
    if (analyzedCount > 0 && analyzedCount <= 15 && dev.impactScore >= 120) {
      insights.push(
        `High aggregate impact (${dev.impactScore}) from ${analyzedCount} AI-analyzed commit(s): reflects severity, breadth (e.g. cross-repo), and business scores — not how many lines or commits alone.`,
      );
    }

    if (dev.reposContributed.length > 1) {
      insights.push(`Cross-repo contributor across ${dev.reposContributed.join(", ")}`);
    }

    if (dev.breakdown.feature > 3) {
      insights.push(`Feature champion — shipped ${dev.breakdown.feature} features`);
    }

    if (dev.avgBusinessImpact >= 70) {
      insights.push(`High business impact — avg score ${dev.avgBusinessImpact}/100`);
    }

    if (dev.breakdown.bug_fix > 2) {
      insights.push(`Reliability guardian — fixed ${dev.breakdown.bug_fix} bugs`);
    }

    if (dev.breakdown.refactor > 2) {
      insights.push(`Code quality advocate — ${dev.breakdown.refactor} refactors`);
    }

    if (dev.totalReviews > 3) {
      insights.push(`Active reviewer — ${dev.totalReviews} reviews, ${dev.prsApproved} approvals`);
    }

    return insights;
  }

  private buildLeaderboard(profiles: DeveloperProfile[]): LeaderboardEntry[] {
    return profiles
      .filter((d) => d.role === "developer")
      .sort((a, b) => b.impactScore - a.impactScore)
      .map((dev, i) => ({
        rank: i + 1,
        developer: dev,
        badge: this.assignBadge(dev, i),
      }));
  }

  private assignBadge(dev: DeveloperProfile, rank: number): string | undefined {
    if (rank === 0) return "Top Contributor";
    if (dev.reposContributed.length > 1) return "Cross-Repo";
    if (dev.breakdown.feature >= 3) return "Feature Builder";
    if (dev.avgBusinessImpact >= 70) return "High Impact";
    if (dev.totalReviews > 5) return "Review Champion";
    return undefined;
  }

  private generateTeamInsights(
    profiles: DeveloperProfile[],
    repos: RepoConfig[],
  ): TeamInsight[] {
    const insights: TeamInsight[] = [];
    const devs = profiles.filter((d) => d.role === "developer");

    const crossRepo = devs.filter((d) => d.reposContributed.length > 1);
    if (crossRepo.length > 0) {
      insights.push({
        category: "collaboration",
        title: "Cross-Repository Contributors",
        description: `${crossRepo.length} developer(s) contribute to multiple repos, showing broad system knowledge.`,
        developers: crossRepo.map((d) => d.login),
      });
    }

    const highImpact = devs.filter((d) => d.avgBusinessImpact >= 65);
    if (highImpact.length > 0) {
      insights.push({
        category: "impact",
        title: "High Business Impact",
        description: `These developers consistently deliver changes with high business value.`,
        developers: highImpact.map((d) => d.login),
      });
    }

    for (const repo of repos) {
      const repoDevs = devs
        .filter((d) => d.repoBreakdown[repo.label])
        .sort((a, b) => (b.repoBreakdown[repo.label]?.score ?? 0) - (a.repoBreakdown[repo.label]?.score ?? 0));

      if (repoDevs.length > 0) {
        insights.push({
          category: "repo",
          title: `${repo.label} — Top Contributors`,
          description: `${repoDevs.length} developer(s) active. Top: ${repoDevs[0].login} with score ${repoDevs[0].repoBreakdown[repo.label]?.score.toFixed(0)}.`,
          developers: repoDevs.slice(0, 3).map((d) => d.login),
        });
      }
    }

    const managers = profiles.filter((d) => d.role === "manager");
    if (managers.length > 0) {
      insights.push({
        category: "management",
        title: "Manager Activity",
        description: `${managers.map((m) => m.login).join(", ")}: ${managers.reduce((a, m) => a + m.totalReviews, 0)} reviews, ${managers.reduce((a, m) => a + m.prsApproved, 0)} approvals.`,
        developers: managers.map((d) => d.login),
      });
    }

    return insights;
  }
}
