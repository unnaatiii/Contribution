import { NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import { explainDbWriteSkip, getUserId, isAnalysisDbConfigured, saveRepo } from "@/lib/db";

export const runtime = "nodejs";

export type ListedRepo = {
  owner: string;
  repo: string;
  fullName: string;
  description: string | null;
  private: boolean;
  htmlUrl: string;
  defaultBranch: string;
};

export async function POST(request: Request) {
  try {
    const { token } = (await request.json()) as { token?: string };

    if (!token?.trim()) {
      return NextResponse.json({ error: "GitHub token is required" }, { status: 400 });
    }

    const octokit = new Octokit({ auth: token });

    const { data: user } = await octokit.users.getAuthenticated();

    const all: ListedRepo[] = [];
    let page = 1;
    const perPage = 100;
    const maxPages = 15;

    while (page <= maxPages) {
      const { data } = await octokit.repos.listForAuthenticatedUser({
        affiliation: "owner,collaborator,organization_member",
        per_page: perPage,
        page,
        sort: "updated",
        direction: "desc",
      });

      for (const r of data) {
        const owner = r.owner?.login ?? "";
        if (!owner || !r.name) continue;
        all.push({
          owner,
          repo: r.name,
          fullName: r.full_name,
          description: r.description,
          private: r.private,
          htmlUrl: r.html_url,
          defaultBranch: r.default_branch ?? "main",
        });
      }

      if (data.length < perPage) break;
      page += 1;
    }

    if (isAnalysisDbConfigured()) {
      const uid = getUserId(token);
      if (uid) {
        console.log(`[list-repos] Saving ${all.length} repos to Supabase for tenant ${uid.slice(0, 12)}…`);
        try {
          for (const r of all) {
            await saveRepo(uid, {
              name: r.repo,
              full_name: r.fullName,
              private: r.private,
            });
          }
        } catch (e) {
          console.error("[list-repos] saveRepo loop failed:", e);
        }
      } else {
        console.warn(
          "[list-repos] getUserId returned null — ensure USER_ID_PEPPER is set in .env.local (required to hash PAT).",
        );
      }
    } else {
      console.warn("[list-repos] Supabase persistence disabled:", explainDbWriteSkip());
    }

    return NextResponse.json({
      success: true,
      login: user.login,
      repos: all,
      total: all.length,
    });
  } catch (err: unknown) {
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status: number }).status)
        : 500;
    const msg =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: string }).message)
        : "Failed to list repositories";
    console.error("[API] list-repos:", status, msg);
    const clientMsg =
      status === 401 || status === 403
        ? "Invalid or expired token — check PAT scopes (repo)."
        : msg;
    return NextResponse.json({ error: clientMsg }, { status: status >= 400 && status < 600 ? status : 500 });
  }
}
