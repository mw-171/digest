/**
 * The one digest setting, kept in a cookie rather than localStorage so the
 * server knows it while rendering the first page. Otherwise a page load would
 * fetch — and possibly pay Claude for — a triage the setting says to skip.
 */
export const AI_COOKIE = "digest_ai";

export const aiCookieValue = (useAi: boolean) =>
  `${AI_COOKIE}=${useAi ? "on" : "off"}; path=/; max-age=31536000; samesite=lax`;

/** AI defaults on. */
export const parseAiCookie = (value: string | undefined) => value !== "off";

/**
 * Whether the AI-triage switch is offered in the footer; `NEXT_PUBLIC_AI_TOGGLE=1`
 * shows it. Hidden by default, but the cookie, query key and `ai=0` parameter
 * behind it all still work — and the literal `process.env` read is what lets
 * Next inline the flag at build time.
 */
export const SHOW_AI_TOGGLE = process.env.NEXT_PUBLIC_AI_TOGGLE === "1";
