import { NextResponse, type NextRequest } from "next/server";
import {
  STATE_COOKIE,
  TOKEN_COOKIE,
  oauthClient,
  originFromHeaders,
  redirectUriFromHeaders,
} from "@/lib/google";

const YEAR = 60 * 60 * 24 * 365;

/**
 * Home again. Built on the forwarded origin rather than on `request.url`,
 * which behind a proxy is the internal address and would bounce the user to a
 * host they never asked for.
 */
function back(request: NextRequest, error?: string) {
  const origin = originFromHeaders(request.headers);
  const url = new URL("/", origin ?? request.url);
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
    // Must be the identical string the authorize step sent, or Google rejects
    // the exchange with redirect_uri_mismatch.
    const redirect = redirectUriFromHeaders(request.headers);
    const { tokens } = await oauthClient(redirect).getToken({
      code,
      redirect_uri: redirect,
    });
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
    secure: originFromHeaders(request.headers)?.startsWith("https:") ?? false,
    path: "/",
    maxAge: YEAR,
  });
  response.cookies.delete(STATE_COOKIE);
  return response;
}
