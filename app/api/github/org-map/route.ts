import { NextResponse } from "next/server";
import { GitHubService } from "@/lib/github-service";
import { tryDeriveUserIdFromToken } from "@/lib/user-id";
import { upsertOrgTenantMap, isAnalysisDbConfigured } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Links a GitHub org login to the current PAT tenant so org webhooks can resolve `user_id`.
 * POST { token, orgLogin, note? }
 */
export async function POST(request: Request) {
  try {
    if (!isAnalysisDbConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    const body = (await request.json()) as {
      token?: string;
      orgLogin?: string;
      note?: string;
    };
    const token = body.token?.trim();
    const orgLogin = body.orgLogin?.trim().toLowerCase();
    if (!token || !orgLogin) {
      return NextResponse.json({ error: "token and orgLogin required" }, { status: 400 });
    }

    const userId = tryDeriveUserIdFromToken(token);
    if (!userId) {
      return NextResponse.json({ error: "USER_ID_PEPPER not configured" }, { status: 503 });
    }

    const gh = new GitHubService(token, {
      since: new Date(0).toISOString(),
      until: new Date().toISOString(),
    });
    const conn = await gh.validateConnection();
    if (!conn.valid) {
      return NextResponse.json({ error: "Invalid GitHub token" }, { status: 401 });
    }

    const ok = await upsertOrgTenantMap(orgLogin, userId, body.note ?? null);
    if (!ok) {
      return NextResponse.json({ error: "Failed to save mapping" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      orgLogin,
      userIdPrefix: userId.slice(0, 12),
    });
  } catch (e) {
    console.error("[org-map]", e);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
