import { Connect } from "./component/digest/connect";
import { DigestClient } from "./component/digest/digest-client";
import { Shell } from "./component/digest/layout-frame";
import { cookies } from "next/headers";

import { AI_COOKIE, parseAiCookie } from "@/lib/preferences";
import { isValidDay, toDayString } from "@/lib/day";
import { authorizedClient, isConfigured, redirectUri } from "@/lib/google";

const ERRORS: Record<string, string> = {
  access_denied: "Consent was declined.",
  bad_state: "The sign-in state didn't match. Try again.",
  missing_code: "Google didn't return an authorization code.",
  no_refresh_token: "Google didn't return a refresh token. Try again.",
  token_exchange_failed: "Could not exchange the code for a token.",
};

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const today = toDayString();
  const requested = typeof params.date === "string" ? params.date : today;
  const day = isValidDay(requested) && requested <= today ? requested : today;
  const errorParam = typeof params.error === "string" ? params.error : null;

  if (!isConfigured()) {
    const callback = await redirectUri();

    return (
      <Shell>
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-8 py-16">
          <h1 className="text-title-h5 text-text-strong-950">Daily Digest</h1>
          <p className="mt-3 text-paragraph-sm text-text-sub-600">
            Add <code>GOOGLE_CLIENT_ID</code> and{" "}
            <code>GOOGLE_CLIENT_SECRET</code> to <code>.env</code>, then restart
            the dev server. The redirect URI registered in Google Cloud must be{" "}
            <code>{callback}</code>.
          </p>
        </div>
      </Shell>
    );
  }

  // Auth is the one thing the server still decides — it owns the cookie.
  if (!(await authorizedClient())) {
    return (
      <Shell>
        {/* No footer here: everything in it — the provenance line, the AI
            switch, Disconnect — belongs to a session this screen does not
            have. */}
        <Connect error={errorParam ? (ERRORS[errorParam] ?? errorParam) : null} />
      </Shell>
    );
  }

  const jar = await cookies();

  return (
    <DigestClient
      initialDay={day}
      today={today}
      initialAi={parseAiCookie(jar.get(AI_COOKIE)?.value)}
    />
  );
}
