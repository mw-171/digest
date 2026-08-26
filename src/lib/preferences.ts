/**
 * The two digest settings, kept in cookies rather than localStorage so the
 * server knows both while rendering the first page. Otherwise a page load
 * would fetch — and possibly pay Claude for — mail the settings say to skip.
 */
export const AI_COOKIE = "digest_ai";
export const BULK_COOKIE = "digest_bulk";

function cookie(name: string, on: boolean) {
  return `${name}=${on ? "on" : "off"}; path=/; max-age=31536000; samesite=lax`;
}

export const aiCookieValue = (useAi: boolean) => cookie(AI_COOKIE, useAi);
export const bulkCookieValue = (includeBulk: boolean) =>
  cookie(BULK_COOKIE, includeBulk);

/** AI defaults on; bulk mail defaults off. */
export const parseAiCookie = (value: string | undefined) => value !== "off";
export const parseBulkCookie = (value: string | undefined) => value === "on";
