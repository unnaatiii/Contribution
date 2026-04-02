import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

const STATE_COOKIE = "github_oauth_state";
const STATE_MAX_AGE = 600;

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: STATE_MAX_AGE,
  path: "/",
};

export async function GET() {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID?.trim();
  const redirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI?.trim();
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error:
          "GitHub OAuth is not configured. Set GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_REDIRECT_URI in .env.local.",
      },
      { status: 503 },
    );
  }

  const state = randomBytes(24).toString("hex");

  const gh = new URL("https://github.com/login/oauth/authorize");
  gh.searchParams.set("client_id", clientId);
  gh.searchParams.set("redirect_uri", redirectUri);
  gh.searchParams.set("scope", "repo read:user read:org");
  gh.searchParams.set("state", state);

  const res = NextResponse.redirect(gh.toString());
  res.cookies.set(STATE_COOKIE, state, cookieOpts);
  return res;
}
