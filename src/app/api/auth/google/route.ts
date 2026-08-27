import { NextResponse } from "next/server";
import {
  GMAIL_SCOPES,
  STATE_COOKIE,
  oauthClient,
  originFromHeaders,
  redirectUriFromHeaders,
} from "@/lib/google";

/** Kick off the consent flow. */
export async function GET(request: Request) {
  const state = crypto.randomUUID();
  const redirect = redirectUriFromHeaders(request.headers);

  const url = oauthClient(redirect).generateAuthUrl({
    access_type: "offline", // ask for a refresh token
    prompt: "consent", // force one even on repeat authorizations
    scope: GMAIL_SCOPES,
    state,
  });

  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    // The scheme the browser used, not the one the proxy used to reach us.
    secure: originFromHeaders(request.headers)?.startsWith("https:") ?? false,
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
