import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const STATE_COOKIE = "github_oauth_state";
const TOKEN_COOKIE = "github_oauth_access_token";
const TOKEN_MAX_AGE = 300;

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

function appOrigin(request: Request): string {
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}`;
}

export async function GET(request: Request) {
  const base = appOrigin(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const ghError = searchParams.get("error");

  const cookieStore = await cookies();
  const storedState = cookieStore.get(STATE_COOKIE)?.value;

  const clearState = (res: NextResponse) => {
    res.cookies.set(STATE_COOKIE, "", { ...cookieOpts, maxAge: 0 });
    return res;
  };

  if (ghError) {
    return clearState(NextResponse.redirect(new URL(`/?github_oauth_error=${encodeURIComponent(ghError)}`, base)));
  }

  if (!code || !state || !storedState || state !== storedState) {
    return clearState(NextResponse.redirect(new URL("/?github_oauth_error=invalid_state", base)));
  }

  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    return clearState(NextResponse.redirect(new URL("/?github_oauth_error=config", base)));
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!data.access_token) {
    const hint = data.error_description ?? data.error ?? "token_exchange";
    return clearState(
      NextResponse.redirect(new URL(`/?github_oauth_error=${encodeURIComponent(hint)}`, base)),
    );
  }

  const res = NextResponse.redirect(new URL("/?github_oauth=1", base));
  res.cookies.set(STATE_COOKIE, "", { ...cookieOpts, maxAge: 0 });
  res.cookies.set(TOKEN_COOKIE, data.access_token, { ...cookieOpts, maxAge: TOKEN_MAX_AGE });
  return res;
}
