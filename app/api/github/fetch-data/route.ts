import { NextRequest, NextResponse } from "next/server";
import { GitHubService } from "@/lib/github-service";

export async function POST(request: NextRequest) {
  try {
    const { token, owner, repo } = await request.json();

    if (!token || !owner || !repo) {
      return NextResponse.json(
        { success: false, error: "token, owner, and repo are required" },
        { status: 400 },
      );
    }

    const github = new GitHubService({ token, owner, repo });
    const data = await github.fetchAllData();

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        summary: {
          contributors: data.contributors.length,
          commits: data.commits.length,
          pullRequests: data.pullRequests.length,
          issues: data.issues.length,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch data" },
      { status: 500 },
    );
  }
}
