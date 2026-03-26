import { NextResponse } from "next/server";
import { after } from "next/server";
import {
  verifyGitHubWebhookSignature,
  parseOrgLogin,
  parseRepositoryFullName,
  type GitHubPushWebhookPayload,
} from "@/lib/github-webhook";
import {
  getUserIdForOrgLogin,
  userHasRepoFullName,
  upsertCommitsWebhookRows,
  incrementTenantAiPending,
  getTenantAiQueue,
  isAnalysisDbConfigured,
} from "@/lib/db";
import { runWebhookAiBatchForUser } from "@/services/webhookAiBatch";

export const runtime = "nodejs";

function inferMergeCommitFromMessage(message: string): boolean {
  return /^Merge (pull request|branch)/i.test(message);
}

function authorFromWebhookCommit(c: NonNullable<GitHubPushWebhookPayload["commits"]>[number]): string {
  const u = c.author?.username?.trim();
  if (u) return u;
  const n = c.author?.name?.trim();
  if (n) return n;
  return "unknown";
}

export async function POST(request: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  if (!isAnalysisDbConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const raw = await request.text();
  const sig = request.headers.get("x-hub-signature-256");
  if (!verifyGitHubWebhookSignature(raw, sig, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = request.headers.get("x-github-event");
  if (event === "ping") {
    return NextResponse.json({ ok: true, ping: true });
  }
  if (event !== "push") {
    return NextResponse.json({ ok: true, ignored: event ?? "unknown" });
  }

  let payload: GitHubPushWebhookPayload;
  try {
    payload = JSON.parse(raw) as GitHubPushWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orgLogin = parseOrgLogin(payload);
  if (!orgLogin) {
    return NextResponse.json({ error: "Organization context required" }, { status: 400 });
  }

  const userId = await getUserIdForOrgLogin(orgLogin);
  if (!userId) {
    console.warn(`[webhook] no tenant map for org ${orgLogin}`);
    return NextResponse.json({ ok: true, mapped: false });
  }

  const fullName = parseRepositoryFullName(payload);
  if (!fullName) {
    return NextResponse.json({ error: "Missing repository" }, { status: 400 });
  }

  const allowed = await userHasRepoFullName(userId, fullName);
  if (!allowed) {
    console.warn(`[webhook] repo ${fullName} not in tenant repos list for ${orgLogin}`);
    return NextResponse.json({ ok: true, skipped: "repo_not_registered" });
  }

  const commits = payload.commits ?? [];
  if (commits.length === 0) {
    return NextResponse.json({ ok: true, commits: 0 });
  }

  const ingested_at = new Date().toISOString();
  const rows: Parameters<typeof upsertCommitsWebhookRows>[1] = [];
  let aiDelta = 0;

  for (const c of commits) {
    const sha = c.id?.trim();
    if (!sha) continue;
    const message = c.message ?? "";
    const isMerge = inferMergeCommitFromMessage(message);
    const analyzed = isMerge;
    if (!isMerge) aiDelta += 1;
    rows.push({
      repo: fullName,
      sha,
      author: authorFromWebhookCommit(c),
      message: message || null,
      date: c.timestamp?.trim() || null,
      analyzed,
      ingested_at,
    });
  }

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, commits: 0 });
  }

  await upsertCommitsWebhookRows(userId, rows);
  if (aiDelta > 0) {
    await incrementTenantAiPending(userId, aiDelta);
  }

  const q = await getTenantAiQueue(userId);
  const pending = q?.pending_count ?? aiDelta;
  if (pending >= 5) {
    after(() => {
      void runWebhookAiBatchForUser(userId).catch((e) => console.error("[webhook] AI batch:", e));
    });
  }

  return NextResponse.json({
    ok: true,
    stored: rows.length,
    aiPendingIncrement: aiDelta,
  });
}
