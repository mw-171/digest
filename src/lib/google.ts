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

/** Loopback and private ranges — a dev server a phone opens over wifi. */
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

// Behind a proxy `Host` is internal, so `x-forwarded-host` wins.
// `x-forwarded-proto` may be a list; the first entry is the client's.
export function originFromHeaders(headers: Headers) {
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return null;

  const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || (isLocal(host) ? "http" : "https");

  return `${protocol}://${host}`;
}

// Derived from the request, so one build works everywhere. Google matches it
// exactly, and the authorize and exchange legs must send the same string.
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

/** `redirect` matters only during consent; refreshing a token never uses it. */
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

/** Primed with the stored refresh token, or null when not connected. */
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
