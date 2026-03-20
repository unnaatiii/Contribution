import { NextRequest, NextResponse } from "next/server";
import { GitHubService } from "@/lib/github-service";

export async function POST(request: NextRequest) {
  try {
    const { token, owner, repo } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: "GitHub token is required" },
        { status: 400 },
      );
    }

    if (!owner || !repo) {
      return NextResponse.json(
        { success: false, error: "Repository owner and name are required" },
        { status: 400 },
      );
    }

    const github = new GitHubService({ token, owner, repo });
    const result = await github.validateConnection();

    if (!result.valid) {
      return NextResponse.json(
        { success: false, error: "Invalid GitHub token" },
        { status: 401 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        user: result.user,
        owner,
        repo,
        message: `Connected as ${result.user} to ${owner}/${repo}`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Connection failed" },
      { status: 500 },
    );
  }
}
