import { DayPicker } from "./day-picker";
import { authorizedClient, isAuthError, isConfigured, redirectUri } from "@/lib/google";
import { fetchDigest, isValidDay, toDayString, type Digest } from "@/lib/gmail";

const ERRORS: Record<string, string> = {
  access_denied: "Consent was declined.",
  bad_state: "The sign-in state didn't match. Try again.",
  missing_code: "Google didn't return an authorization code.",
  no_refresh_token: "Google didn't return a refresh token. Try again.",
  token_exchange_failed: "Could not exchange the code for a token. Check the console.",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 justify-center bg-bg-weak-50 px-6 py-12">
      <main className="w-full max-w-2xl">{children}</main>
    </div>
  );
}

function time(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function MessageList({ digest }: { digest: Digest }) {
  if (digest.messages.length === 0) {
    return <p className="py-12 text-center text-text-soft-400">No mail on this day.</p>;
  }

  return (
    <ul className="divide-y divide-stroke-soft-200 rounded-10 border border-stroke-soft-200 bg-bg-white-0">
      {digest.messages.map((message) => (
        <li key={message.id} className="flex gap-3 px-4 py-3">
          <span className="w-16 shrink-0 pt-0.5 text-xs text-text-soft-400">
            {time(message.receivedAt)}
          </span>
          <div className="min-w-0">
            <p className="flex items-baseline gap-2 text-sm">
              <span
                className={
                  message.unread
                    ? "font-medium text-text-strong-950"
                    : "text-text-sub-600"
                }
              >
                {message.from}
              </span>
              {message.unread && (
                <span className="text-[10px] uppercase tracking-wide text-primary-base">
                  unread
                </span>
              )}
            </p>
            <p className="truncate text-sm text-text-strong-950">{message.subject}</p>
            <p className="line-clamp-2 text-sm text-text-soft-400">{message.snippet}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const today = toDayString();
  const requested = typeof params.date === "string" ? params.date : today;
  const day = isValidDay(requested) ? requested : today;
  const errorParam = typeof params.error === "string" ? params.error : null;

  if (!isConfigured()) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-text-strong-950">Daily Digest</h1>
        <p className="mt-3 text-sm text-text-sub-600">
          Add <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> to{" "}
          <code>.env</code>, then restart the dev server. The redirect URI registered in
          the Google Cloud console must be <code>{redirectUri()}</code>.
        </p>
      </Shell>
    );
  }

  const auth = await authorizedClient();

  if (!auth) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-text-strong-950">Daily Digest</h1>
        <p className="mt-3 text-sm text-text-sub-600">
          Connect your Gmail account to read a day at a time.
        </p>
        {errorParam && (
          <p className="mt-3 text-sm text-error-base">
            {ERRORS[errorParam] ?? errorParam}
          </p>
        )}
        <a
          href="/api/auth/google"
          className="mt-6 inline-block rounded-10 bg-bg-strong-950 px-4 py-2 text-sm text-text-white-0"
        >
          Connect Gmail
        </a>
      </Shell>
    );
  }

  let digest: Digest | null = null;
  let fetchError: string | null = null;
  let needsReconnect = false;

  try {
    digest = await fetchDigest(auth, day);
  } catch (error) {
    console.error("Gmail fetch failed", error);
    needsReconnect = isAuthError(error);
    fetchError = error instanceof Error ? error.message : String(error);
  }

  return (
    <Shell>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-strong-950">Daily Digest</h1>
          {digest && (
            <p className="text-sm text-text-soft-400">
              {digest.messages.length} message
              {digest.messages.length === 1 ? "" : "s"}
              {digest.truncated && " (first 100)"}
            </p>
          )}
        </div>
        <DayPicker day={day} today={today} />
      </header>

      {fetchError ? (
        <div className="rounded-10 border border-stroke-soft-200 bg-bg-white-0 p-4 text-sm">
          <p className="text-error-base">{fetchError}</p>
          {needsReconnect && (
            <a href="/api/auth/google" className="mt-2 inline-block underline">
              Reconnect Gmail
            </a>
          )}
        </div>
      ) : (
        digest && <MessageList digest={digest} />
      )}

      <footer className="mt-6 text-xs text-text-soft-400">
        <a href="/api/auth/logout" className="underline">
          Disconnect
        </a>
      </footer>
    </Shell>
  );
}
