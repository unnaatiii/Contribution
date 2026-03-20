import OpenAI from "openai";
import type {
  CommitData,
  PullRequestData,
  ContributionClassification,
  ImpactAnalysis,
  ContributionType,
} from "./types";

export class AIAnalyzer {
  private openai: OpenAI | null;

  constructor(apiKey?: string) {
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;
  }

  async classifyCommit(commit: CommitData): Promise<ImpactAnalysis> {
    if (!this.openai) return this.fallbackAnalysis(commit);

    const prompt = `Analyze this Git commit and provide an impact assessment.

Commit Message: "${commit.message}"
Files Changed: ${commit.filesChanged}
Lines Added: ${commit.additions}
Lines Deleted: ${commit.deletions}
Files Modified:
${commit.files
  .slice(0, 10)
  .map((f) => `  - ${f.filename} (${f.status}: +${f.additions}/-${f.deletions})`)
  .join("\n")}

Respond in this exact JSON format:
{
  "type": "<one of: feature, bugfix, refactor, documentation, test, chore, performance, security>",
  "confidence": <0.0 to 1.0>,
  "reasoning": "<one sentence explaining classification>",
  "businessValue": <1 to 10>,
  "complexity": <1 to 10>,
  "codeQuality": <1 to 10>,
  "summary": "<one sentence impact summary>"
}

Scoring guidance:
- businessValue: How much does this impact users/product? Feature=high, typo fix=low, critical bugfix=very high
- complexity: How complex is the change? Simple rename=low, algorithm rewrite=high, architectural change=very high
- codeQuality: Does this improve maintainability? Refactors=high, adding tests=high, quick hacks=low
- Do NOT just count lines of code. A 5-line security fix is more impactful than a 500-line config change.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a senior engineering manager analyzing code contributions. Respond only with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 300,
      });

      const content = response.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());

      const classification: ContributionClassification = {
        type: parsed.type ?? "chore",
        confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
        reasoning: parsed.reasoning ?? "Unable to determine",
      };

      const impactScore = this.calculateImpactScore(
        parsed.businessValue ?? 5,
        parsed.complexity ?? 5,
        parsed.codeQuality ?? 5,
        classification.type,
      );

      return {
        impactScore,
        businessValue: parsed.businessValue ?? 5,
        complexity: parsed.complexity ?? 5,
        codeQuality: parsed.codeQuality ?? 5,
        classification,
        summary: parsed.summary ?? "Contribution analyzed",
      };
    } catch {
      return this.fallbackAnalysis(commit);
    }
  }

  async classifyPR(pr: PullRequestData): Promise<ImpactAnalysis> {
    if (!this.openai) return this.fallbackPRAnalysis(pr);

    const prompt = `Analyze this Pull Request and provide an impact assessment.

PR Title: "${pr.title}"
State: ${pr.state} | Merged: ${pr.merged}
Lines Added: ${pr.additions} | Lines Deleted: ${pr.deletions}
Files Changed: ${pr.changed_files}
Review Comments: ${pr.review_comments}
Labels: ${pr.labels.join(", ") || "none"}

Respond in this exact JSON format:
{
  "type": "<one of: feature, bugfix, refactor, documentation, test, chore, performance, security>",
  "confidence": <0.0 to 1.0>,
  "reasoning": "<one sentence explaining classification>",
  "businessValue": <1 to 10>,
  "complexity": <1 to 10>,
  "codeQuality": <1 to 10>,
  "summary": "<one sentence impact summary>"
}

Consider:
- Merged PRs with many review comments suggest thorough, high-quality contributions
- PRs that fix critical bugs have outsized business value
- Large feature PRs with tests demonstrate high code quality`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a senior engineering manager analyzing code contributions. Respond only with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 300,
      });

      const content = response.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());

      const classification: ContributionClassification = {
        type: parsed.type ?? "chore",
        confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
        reasoning: parsed.reasoning ?? "Unable to determine",
      };

      const mergedBonus = pr.merged ? 1.5 : 0.5;
      const impactScore =
        this.calculateImpactScore(
          parsed.businessValue ?? 5,
          parsed.complexity ?? 5,
          parsed.codeQuality ?? 5,
          classification.type,
        ) * mergedBonus;

      return {
        impactScore,
        businessValue: parsed.businessValue ?? 5,
        complexity: parsed.complexity ?? 5,
        codeQuality: parsed.codeQuality ?? 5,
        classification,
        summary: parsed.summary ?? "PR analyzed",
      };
    } catch {
      return this.fallbackPRAnalysis(pr);
    }
  }

  async generateDeveloperSummary(
    login: string,
    stats: {
      totalScore: number;
      commits: number;
      prs: number;
      mergedPRs: number;
      breakdown: Record<string, number>;
    },
  ): Promise<string> {
    const prompt = `Summarize this developer's contribution profile in 2-3 sentences.

Developer: ${login}
Impact Score: ${stats.totalScore.toFixed(1)}
Commits: ${stats.commits}
PRs: ${stats.prs} (${stats.mergedPRs} merged)
Contribution Types: ${Object.entries(stats.breakdown)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ")}

Focus on their strengths and impact areas. Be specific and constructive.`;

    if (!this.openai) {
      return `${login} has contributed ${stats.commits} commits and ${stats.prs} PRs with a total impact score of ${stats.totalScore.toFixed(1)}.`;
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a thoughtful engineering manager writing performance insights.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 150,
      });

      return response.choices[0]?.message?.content ?? "Analysis complete.";
    } catch {
      return `${login} has contributed ${stats.commits} commits and ${stats.prs} PRs with a total impact score of ${stats.totalScore.toFixed(1)}.`;
    }
  }

  private calculateImpactScore(
    businessValue: number,
    complexity: number,
    codeQuality: number,
    type: ContributionType,
  ): number {
    const typeWeights: Record<ContributionType, number> = {
      feature: 2.0,
      security: 2.5,
      bugfix: 1.8,
      performance: 1.6,
      refactor: 1.3,
      test: 1.2,
      documentation: 0.8,
      chore: 0.5,
    };

    const weight = typeWeights[type] ?? 1.0;

    return (businessValue * 0.4 + complexity * 0.3 + codeQuality * 0.3) * weight;
  }

  private fallbackAnalysis(commit: CommitData): ImpactAnalysis {
    const msg = commit.message.toLowerCase();
    let type: ContributionType = "chore";

    if (msg.includes("feat") || msg.includes("add") || msg.includes("implement"))
      type = "feature";
    else if (msg.includes("fix") || msg.includes("bug") || msg.includes("patch")) type = "bugfix";
    else if (msg.includes("refactor") || msg.includes("clean")) type = "refactor";
    else if (msg.includes("doc") || msg.includes("readme")) type = "documentation";
    else if (msg.includes("test") || msg.includes("spec")) type = "test";
    else if (msg.includes("perf") || msg.includes("optim")) type = "performance";
    else if (msg.includes("security") || msg.includes("vuln")) type = "security";

    const complexity = Math.min(10, Math.max(1, Math.log2(commit.filesChanged + 1) * 3));
    const businessValue = type === "feature" ? 7 : type === "bugfix" ? 6 : 4;
    const codeQuality = 5;

    return {
      impactScore: this.calculateImpactScore(businessValue, complexity, codeQuality, type),
      businessValue,
      complexity,
      codeQuality,
      classification: { type, confidence: 0.4, reasoning: "Classified by commit message keywords" },
      summary: `${type} contribution with ${commit.filesChanged} files changed`,
    };
  }

  private fallbackPRAnalysis(pr: PullRequestData): ImpactAnalysis {
    const title = pr.title.toLowerCase();
    let type: ContributionType = "chore";

    if (title.includes("feat") || title.includes("add")) type = "feature";
    else if (title.includes("fix") || title.includes("bug")) type = "bugfix";
    else if (title.includes("refactor")) type = "refactor";
    else if (title.includes("doc")) type = "documentation";
    else if (title.includes("test")) type = "test";

    const complexity = Math.min(10, Math.max(1, Math.log2(pr.changed_files + 1) * 3));
    const businessValue = type === "feature" ? 7 : type === "bugfix" ? 6 : 4;
    const mergedBonus = pr.merged ? 1.5 : 0.5;

    return {
      impactScore:
        this.calculateImpactScore(businessValue, complexity, 5, type) * mergedBonus,
      businessValue,
      complexity,
      codeQuality: 5,
      classification: { type, confidence: 0.3, reasoning: "Classified by PR title keywords" },
      summary: `${type} PR: ${pr.title}`,
    };
  }
}
