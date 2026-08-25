import { google } from "googleapis";
import { cookies } from "next/headers";

/** Read-only Gmail. Matches the scope enabled on the GCP project. */
export const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

export const TOKEN_COOKIE = "gmail_refresh_token";
export const STATE_COOKIE = "google_oauth_state";

export const DEFAULT_REDIRECT_URI =
  "http://localhost:3000/api/auth/callback/google";

export type OAuthClient = ReturnType<typeof oauthClient>;

export function redirectUri() {
  return process.env.GOOGLE_REDIRECT_URI ?? DEFAULT_REDIRECT_URI;
}

/** True when the app has enough config to attempt the OAuth flow. */
export function isConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function oauthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET. Add them to .env and restart the dev server.",
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri());
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
