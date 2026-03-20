import { NextRequest, NextResponse } from "next/server";
import { GitHubService } from "@/lib/github-service";
import { ScoringEngine } from "@/lib/scoring-engine";

export async function POST(request: NextRequest) {
  try {
    const { token, owner, repo, openaiKey, limit = 10 } = await request.json();

    if (!token || !owner || !repo) {
      return NextResponse.json(
        { success: false, error: "token, owner, and repo are required" },
        { status: 400 },
      );
    }

    const aiKey = openaiKey || process.env.OPENAI_API_KEY || undefined;

    const github = new GitHubService({ token, owner, repo });
    const repoData = await github.fetchAllData();
    const engine = new ScoringEngine(aiKey);
    const result = await engine.analyzeRepository(repoData);

    return NextResponse.json({
      success: true,
      data: {
        leaderboard: result.leaderboard.slice(0, limit),
        sprintTopContributor: result.sprintTopContributor,
        teamInsights: result.teamInsights,
        repository: result.repository,
        analyzedAt: result.analyzedAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Leaderboard failed" },
      { status: 500 },
    );
  }
}
