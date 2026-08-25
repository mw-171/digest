import { NextResponse } from "next/server";
import { GMAIL_SCOPES, STATE_COOKIE, oauthClient } from "@/lib/google";

/** Kick off the consent flow. */
export async function GET(request: Request) {
  const state = crypto.randomUUID();

  const url = oauthClient().generateAuthUrl({
    access_type: "offline", // ask for a refresh token
    prompt: "consent", // force one even on repeat authorizations
    scope: GMAIL_SCOPES,
    state,
  });

  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
