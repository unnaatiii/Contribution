import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const TOKEN_COOKIE = "github_oauth_access_token";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value ?? null;

  const res = NextResponse.json({ access_token: token });

  if (token) {
    res.cookies.delete(TOKEN_COOKIE);
  }

  return res;
}
