// A cookie, not localStorage: the server reads it while rendering the first
// page, before it decides whether to pay Claude for a triage.
export const AI_COOKIE = "digest_ai";

export const aiCookieValue = (useAi: boolean) =>
  `${AI_COOKIE}=${useAi ? "on" : "off"}; path=/; max-age=31536000; samesite=lax`;

/** Defaults on. */
export const parseAiCookie = (value: string | undefined) => value !== "off";

// Set NEXT_PUBLIC_AI_TOGGLE=1 to show the footer switch. Read as a literal
// `process.env` expression, which is what lets Next inline it at build time.
export const SHOW_AI_TOGGLE = process.env.NEXT_PUBLIC_AI_TOGGLE === "1";
