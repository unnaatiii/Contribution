import { NextResponse } from "next/server";
import { GitHubService } from "@/lib/github-service";
import type { RepoConfig } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { token, repos } = (await request.json()) as {
      token: string;
      repos: RepoConfig[];
    };

    if (!token) {
      return NextResponse.json({ error: "GitHub token is required" }, { status: 400 });
    }

    const githubService = new GitHubService(token, {
      since: new Date(0).toISOString(),
      until: new Date().toISOString(),
    });
    const connection = await githubService.validateConnection();

    if (!connection.valid) {
      return NextResponse.json({ error: "Invalid GitHub token" }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      data: {
        user: connection.user,
        repos: repos?.length ?? 0,
        message: `Connected as ${connection.user}. ${repos?.length ?? 0} repos configured.`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Connection failed" }, { status: 500 });
  }
}
