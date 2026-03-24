import { NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import type { RepoConfig } from "@/lib/types";

export const runtime = "nodejs";

/** Same shape as collaborators route + aggregated commit counts (GitHub “Contributors” graph). */
export type RepoContributorRow = {
  login: string;
  avatar_url: string;
  html_url: string | null;
  contributions: number;
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
    const byLogin = new Map<string, RepoContributorRow>();
    const warnings: string[] = [];

    for (const r of repos) {
      if (!r.owner?.trim() || !r.repo?.trim()) continue;
      let page = 1;
      const perPage = 100;

      try {
        while (true) {
          const { data } = await octokit.repos.listContributors({
            owner: r.owner,
            repo: r.repo,
            per_page: perPage,
            page,
          });

          for (const row of data) {
            const login = row.login;
            if (!login || BOT.test(login)) continue;
            const key = login.toLowerCase();
            const prev = byLogin.get(key);
            const add = row.contributions ?? 0;
            if (!prev) {
              byLogin.set(key, {
                login,
                avatar_url: row.avatar_url ?? `https://github.com/${login}.png`,
                html_url: row.html_url ?? null,
                contributions: add,
              });
            } else {
              prev.contributions += add;
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

    const members = [...byLogin.values()].sort((a, b) => b.contributions - a.contributions);

    if (members.length === 0 && warnings.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Could not list contributors for any repository. Ensure the token has repo scope and can read the selected repos.",
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
    console.error("[API] repo-contributors:", err);
    return NextResponse.json({ error: "Failed to load contributors" }, { status: 500 });
  }
}
