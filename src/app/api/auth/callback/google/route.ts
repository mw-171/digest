import { NextResponse, type NextRequest } from "next/server";
import { STATE_COOKIE, TOKEN_COOKIE, oauthClient } from "@/lib/google";

const YEAR = 60 * 60 * 24 * 365;

function back(request: NextRequest, error?: string) {
  const url = new URL("/", request.url);
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

/** Exchange the authorization code for a refresh token. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const denied = params.get("error");
  if (denied) return back(request, denied);

  const code = params.get("code");
  const state = params.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;

  if (!code) return back(request, "missing_code");
  if (!state || state !== expectedState) return back(request, "bad_state");

  let refreshToken: string | null | undefined;
  try {
    const { tokens } = await oauthClient().getToken(code);
    refreshToken = tokens.refresh_token;
  } catch (error) {
    console.error("Token exchange failed", error);
    return back(request, "token_exchange_failed");
  }

  // Google only returns a refresh token when the grant is new; `prompt=consent`
  // on the authorize step is what keeps this from happening.
  if (!refreshToken) return back(request, "no_refresh_token");

  const response = back(request);
  response.cookies.set(TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: YEAR,
  });
  response.cookies.delete(STATE_COOKIE);
  return response;
}
