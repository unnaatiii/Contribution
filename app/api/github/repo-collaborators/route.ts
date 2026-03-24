import { NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import type { RepoConfig } from "@/lib/types";

export const runtime = "nodejs";

export type CollaboratorMember = {
  login: string;
  avatar_url: string;
  html_url: string | null;
};

const BOT = /\[bot\]|dependabot|renovate|github-actions/i;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string; repos?: RepoConfig[] };
    const token = body.token?.trim();
    const repos = body.repos;

    if (!token || !repos?.length) {
      return NextResponse.json({ error: "token and repos[] required" }, { status: 400 });
    }

    const octokit = new Octokit({ auth: token });
    const byLogin = new Map<string, CollaboratorMember>();
    const warnings: string[] = [];

    for (const r of repos) {
      if (!r.owner?.trim() || !r.repo?.trim()) continue;
      let page = 1;
      const perPage = 100;

      try {
        while (true) {
          const { data } = await octokit.repos.listCollaborators({
            owner: r.owner,
            repo: r.repo,
            affiliation: "all",
            per_page: perPage,
            page,
          });

          for (const u of data) {
            const login = u.login;
            if (!login || BOT.test(login)) continue;
            const key = login.toLowerCase();
            if (!byLogin.has(key)) {
              byLogin.set(key, {
                login,
                avatar_url: u.avatar_url,
                html_url: u.html_url ?? null,
              });
            }
          }

          if (data.length < perPage) break;
          page += 1;
        }
      } catch (err: unknown) {
        const msg =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "unknown error";
        const status =
          err && typeof err === "object" && "status" in err
            ? Number((err as { status: number }).status)
            : 0;
        warnings.push(`${r.owner}/${r.repo} (${status || "?"}): ${msg}`);
      }
    }

    const members = [...byLogin.values()].sort((a, b) => a.login.localeCompare(b.login));

    if (members.length === 0 && warnings.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Could not list collaborators for any repository. Your token needs repo access; listing collaborators may require admin on the repo.",
          warnings,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      members,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (err) {
    console.error("[API] repo-collaborators:", err);
    return NextResponse.json({ error: "Failed to load collaborators" }, { status: 500 });
  }
}
