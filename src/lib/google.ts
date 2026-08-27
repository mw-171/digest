import { google } from "googleapis";
import { cookies, headers as nextHeaders } from "next/headers";

/** Read-only Gmail. Matches the scope enabled on the GCP project. */
export const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

export const TOKEN_COOKIE = "gmail_refresh_token";
export const STATE_COOKIE = "google_oauth_state";

export const CALLBACK_PATH = "/api/auth/callback/google";

export const DEFAULT_ORIGIN = "http://localhost:3000";

export const DEFAULT_REDIRECT_URI = `${DEFAULT_ORIGIN}${CALLBACK_PATH}`;

export type OAuthClient = ReturnType<typeof oauthClient>;

/**
 * Hosts that are reached without TLS when nothing says otherwise: loopback,
 * and the private ranges a dev server is on when a phone opens it over the
 * same wifi.
 */
function isLocal(host: string) {
  const name = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  return (
    name === "localhost" ||
    name.endsWith(".localhost") ||
    name === "::1" ||
    /^127\./.test(name) ||
    /^10\./.test(name) ||
    /^192\.168\./.test(name) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(name)
  );
}

/**
 * The origin this request actually arrived on.
 *
 * Behind a proxy — Vercel, or anything else that terminates TLS — `Host` is
 * the internal hostname and the public one is in `x-forwarded-host`, so the
 * forwarded pair wins where it exists. `x-forwarded-proto` can be a list when
 * a request crossed more than one hop; the first entry is the client's.
 */
export function originFromHeaders(headers: Headers) {
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return null;

  const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || (isLocal(host) ? "http" : "https");

  return `${protocol}://${host}`;
}

/**
 * Where Google should send the user back to.
 *
 * Derived from the request rather than baked in, so the same build works on
 * localhost, on a preview deployment and in production. `GOOGLE_REDIRECT_URI`
 * still wins when set, for the case where consent has to land somewhere other
 * than the host that served the page.
 *
 * Google matches this string exactly against the authorized redirect URIs on
 * the OAuth client, and the value sent here must be the same one sent at the
 * token exchange — both come from the same request headers, so they agree.
 */
export function redirectUriFromHeaders(headers: Headers) {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;

  const origin = originFromHeaders(headers);
  return origin ? `${origin}${CALLBACK_PATH}` : DEFAULT_REDIRECT_URI;
}

/** The same, for server components, which read headers from the store. */
export async function redirectUri() {
  return redirectUriFromHeaders(await nextHeaders());
}

/** True when the app has enough config to attempt the OAuth flow. */
export function isConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/**
 * `redirect` matters only for the two legs of the consent flow, where it has
 * to match what Google was told. Refreshing an existing token never uses it.
 */
export function oauthClient(redirect: string = DEFAULT_REDIRECT_URI) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET. Add them to .env and restart the dev server.",
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirect);
}

/**
 * An OAuth client primed with the stored refresh token, or `null` when the
 * user hasn't connected Gmail yet. googleapis mints access tokens as needed.
 */
export async function authorizedClient(): Promise<OAuthClient | null> {
  const refreshToken = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!refreshToken) return null;

  const client = oauthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

/** A revoked or expired refresh token — the user has to reconnect. */
export function isAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /invalid_grant|invalid_client|unauthorized/i.test(message);
}
