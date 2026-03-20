import type {
  RepositoryData,
  DeveloperProfile,
  LeaderboardEntry,
  AnalysisResult,
  TeamInsight,
  ImpactAnalysis,
  ContributionType,
  WeeklyScore,
  DeveloperInsight,
} from "./types";
import { AIAnalyzer } from "./ai-analyzer";

export class ScoringEngine {
  private analyzer: AIAnalyzer;

  constructor(openaiApiKey?: string) {
    this.analyzer = new AIAnalyzer(openaiApiKey);
  }

  async analyzeRepository(repoData: RepositoryData): Promise<AnalysisResult> {
    const developerMap = new Map<string, DeveloperProfile>();

    for (const contributor of repoData.contributors) {
      developerMap.set(contributor.login, {
        login: contributor.login,
        avatar_url: contributor.avatar_url,
        html_url: contributor.html_url,
        totalImpactScore: 0,
        totalCommits: 0,
        totalPRs: 0,
        mergedPRs: 0,
        prAcceptanceRate: 0,
        totalIssues: 0,
        contributionBreakdown: {
          feature: 0,
          bugfix: 0,
          refactor: 0,
          documentation: 0,
          test: 0,
          chore: 0,
          performance: 0,
          security: 0,
        },
        impactBreakdown: {
          businessValue: 0,
          complexity: 0,
          codeQuality: 0,
          frequency: 0,
        },
        weeklyScores: [],
        insights: [],
        tier: "growing",
      });
    }

    const commitAnalyses = new Map<string, ImpactAnalysis[]>();

    for (const commit of repoData.commits) {
      const analysis = await this.analyzer.classifyCommit(commit);
      const existing = commitAnalyses.get(commit.author) ?? [];
      existing.push(analysis);
      commitAnalyses.set(commit.author, existing);

      const profile = developerMap.get(commit.author);
      if (profile) {
        profile.totalCommits++;
        profile.totalImpactScore += analysis.impactScore;
        profile.contributionBreakdown[analysis.classification.type]++;
        profile.impactBreakdown.businessValue += analysis.businessValue;
        profile.impactBreakdown.complexity += analysis.complexity;
        profile.impactBreakdown.codeQuality += analysis.codeQuality;
      }
    }

    for (const pr of repoData.pullRequests) {
      const analysis = await this.analyzer.classifyPR(pr);
      const profile = developerMap.get(pr.author);
      if (profile) {
        profile.totalPRs++;
        if (pr.merged) profile.mergedPRs++;
        profile.totalImpactScore += analysis.impactScore;
        profile.contributionBreakdown[analysis.classification.type]++;
        profile.impactBreakdown.businessValue += analysis.businessValue;
        profile.impactBreakdown.complexity += analysis.complexity;
        profile.impactBreakdown.codeQuality += analysis.codeQuality;
      }
    }

    for (const issue of repoData.issues) {
      const profile = developerMap.get(issue.author);
      if (profile) {
        profile.totalIssues++;
      }
    }

    const developers = Array.from(developerMap.values()).filter(
      (d) => d.totalCommits > 0 || d.totalPRs > 0,
    );

    for (const dev of developers) {
      dev.prAcceptanceRate =
        dev.totalPRs > 0 ? Math.round((dev.mergedPRs / dev.totalPRs) * 100) : 0;

      const total = dev.totalCommits + dev.totalPRs;
      if (total > 0) {
        dev.impactBreakdown.businessValue = Math.round(dev.impactBreakdown.businessValue / total);
        dev.impactBreakdown.complexity = Math.round(dev.impactBreakdown.complexity / total);
        dev.impactBreakdown.codeQuality = Math.round(dev.impactBreakdown.codeQuality / total);
      }
      dev.impactBreakdown.frequency = Math.min(10, Math.round(total / 5));

      dev.weeklyScores = this.computeWeeklyScores(dev.login, repoData);
      dev.insights = this.generateInsights(dev);
      dev.tier = this.assignTier(dev);
    }

    developers.sort((a, b) => b.totalImpactScore - a.totalImpactScore);

    const leaderboard: LeaderboardEntry[] = developers.map((dev, idx) => ({
      rank: idx + 1,
      developer: { ...dev, rank: idx + 1 },
      badge: this.assignBadge(dev, idx),
    }));

    const teamInsights = this.generateTeamInsights(developers);
    const sprintTop = leaderboard[0] ?? null;

    return {
      repository: { owner: repoData.owner, repo: repoData.repo },
      developers,
      leaderboard,
      sprintTopContributor: sprintTop,
      teamInsights,
      analyzedAt: new Date().toISOString(),
    };
  }

  private computeWeeklyScores(login: string, repoData: RepositoryData): WeeklyScore[] {
    const weekMap = new Map<string, WeeklyScore>();
    const userCommits = repoData.commits.filter((c) => c.author === login);
    const userPRs = repoData.pullRequests.filter((p) => p.author === login);

    for (const commit of userCommits) {
      const week = this.getWeekLabel(commit.date);
      const entry = weekMap.get(week) ?? { week, score: 0, commits: 0, prs: 0 };
      entry.commits++;
      entry.score += 5;
      weekMap.set(week, entry);
    }

    for (const pr of userPRs) {
      const week = this.getWeekLabel(pr.created_at);
      const entry = weekMap.get(week) ?? { week, score: 0, commits: 0, prs: 0 };
      entry.prs++;
      entry.score += pr.merged ? 15 : 5;
      weekMap.set(week, entry);
    }

    return Array.from(weekMap.values()).sort(
      (a, b) => new Date(a.week).getTime() - new Date(b.week).getTime(),
    );
  }

  private getWeekLabel(dateStr: string): string {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split("T")[0];
  }

  private generateInsights(dev: DeveloperProfile): DeveloperInsight[] {
    const insights: DeveloperInsight[] = [];

    const topType = (Object.entries(dev.contributionBreakdown) as [ContributionType, number][])
      .sort(([, a], [, b]) => b - a)[0];

    if (topType && topType[1] > 0) {
      insights.push({
        type: "strength",
        message: `Primary focus area: ${topType[0]} (${topType[1]} contributions)`,
      });
    }

    if (dev.prAcceptanceRate >= 80 && dev.totalPRs >= 3) {
      insights.push({
        type: "highlight",
        message: `Excellent PR acceptance rate of ${dev.prAcceptanceRate}% across ${dev.totalPRs} PRs`,
      });
    }

    if (
      dev.impactBreakdown.businessValue >= 7 &&
      dev.impactBreakdown.complexity >= 6
    ) {
      insights.push({
        type: "highlight",
        message: "Consistently delivers high-value, complex contributions",
      });
    }

    if (
      dev.totalCommits > 20 &&
      dev.totalImpactScore / (dev.totalCommits + dev.totalPRs) < 5
    ) {
      insights.push({
        type: "opportunity",
        message: "High activity but moderate per-contribution impact. Consider focusing on larger, more impactful changes.",
      });
    }

    if (dev.contributionBreakdown.bugfix > dev.totalCommits * 0.5) {
      insights.push({
        type: "strength",
        message: "Key bug-fixing contributor — critical for product stability",
      });
    }

    return insights;
  }

  private assignTier(dev: DeveloperProfile): DeveloperProfile["tier"] {
    const avgImpact =
      dev.totalCommits + dev.totalPRs > 0
        ? dev.totalImpactScore / (dev.totalCommits + dev.totalPRs)
        : 0;

    if (avgImpact >= 12 && dev.prAcceptanceRate >= 80) return "exceptional";
    if (avgImpact >= 8) return "high";
    if (avgImpact >= 4) return "medium";
    return "growing";
  }

  private assignBadge(dev: DeveloperProfile, rank: number): string | undefined {
    if (rank === 0) return "Most Impactful";

    const topBugfixer = dev.contributionBreakdown.bugfix >= 5;
    if (topBugfixer) return "Bug Slayer";

    if (dev.contributionBreakdown.feature >= 5) return "Feature Champion";
    if (dev.prAcceptanceRate >= 90 && dev.totalPRs >= 5) return "Quality Gatekeeper";
    if (dev.contributionBreakdown.refactor >= 5) return "Code Architect";

    return undefined;
  }

  private generateTeamInsights(developers: DeveloperProfile[]): TeamInsight[] {
    const insights: TeamInsight[] = [];

    if (developers.length === 0) return insights;

    const highImpact = developers.filter((d) => d.tier === "exceptional" || d.tier === "high");
    if (highImpact.length > 0) {
      insights.push({
        category: "performance",
        title: "Most Impactful Contributors",
        description: `${highImpact.length} developer(s) are consistently delivering high-impact contributions.`,
        developers: highImpact.map((d) => d.login),
      });
    }

    const highEffortLowImpact = developers.filter((d) => {
      const total = d.totalCommits + d.totalPRs;
      return total > 10 && d.totalImpactScore / total < 5;
    });
    if (highEffortLowImpact.length > 0) {
      insights.push({
        category: "opportunity",
        title: "High Effort, Lower Impact",
        description:
          "These contributors are active but could benefit from focusing on higher-impact work.",
        developers: highEffortLowImpact.map((d) => d.login),
      });
    }

    const hiddenPerformers = developers.filter((d) => {
      const total = d.totalCommits + d.totalPRs;
      return total <= 10 && total > 0 && d.totalImpactScore / total >= 10;
    });
    if (hiddenPerformers.length > 0) {
      insights.push({
        category: "discovery",
        title: "Hidden Performers",
        description:
          "These developers have fewer contributions but each one is highly impactful.",
        developers: hiddenPerformers.map((d) => d.login),
      });
    }

    const featureHeavy = developers.filter(
      (d) =>
        d.contributionBreakdown.feature >
        Object.values(d.contributionBreakdown).reduce((a, b) => a + b, 0) * 0.5,
    );
    if (featureHeavy.length > 0) {
      insights.push({
        category: "focus",
        title: "Feature-Focused Developers",
        description: "These developers primarily build new features.",
        developers: featureHeavy.map((d) => d.login),
      });
    }

    return insights;
  }
}
