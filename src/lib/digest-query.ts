import { toDayString } from "@/lib/day";
import type { DayDigest, WeekDay } from "@/lib/digest";

export type DigestOptions = { useAi: boolean; includeBulk: boolean };

export const dayKey = (day: string, options: DigestOptions) =>
  [
    "day",
    day,
    options.useAi ? "ai" : "plain",
    options.includeBulk ? "all" : "nobulk",
  ] as const;

export const weekKey = (day: string, options: DigestOptions) =>
  ["week", day, options.includeBulk ? "all" : "nobulk"] as const;

export class DigestRequestError extends Error {
  status: number;
  reconnect: boolean;

  constructor(message: string, status: number, reconnect: boolean) {
    super(message);
    this.name = "DigestRequestError";
    this.status = status;
    this.reconnect = reconnect;
  }
}

async function getJson<T>(url: string): Promise<T> {
  // The tab reload is the refresh gesture, so never let the browser answer a
  // digest request out of its own HTTP cache.
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new DigestRequestError(
      body.error ?? `Request failed (${response.status})`,
      response.status,
      Boolean(body.reconnect) || response.status === 401,
    );
  }

  return response.json();
}

/**
 * Never stale, on purpose. The cache lives in memory for exactly one tab
 * session, so reloading the tab already throws it away and re-hits Gmail —
 * that is the refresh gesture, and there is no button or timer besides it.
 * Within a session, paging back to a day you have already opened is instant
 * and costs nothing.
 *
 * Both settings are part of the key, so flipping either toggle swaps between
 * cached views of the same day rather than throwing any of them away.
 */
export function dayQuery(day: string, options: DigestOptions) {
  const params = new URLSearchParams({ date: day });
  if (!options.useAi) params.set("ai", "0");
  if (options.includeBulk) params.set("bulk", "1");

  return {
    queryKey: dayKey(day, options),
    queryFn: () => getJson<DayDigest>(`/api/digest?${params}`),
    staleTime: Infinity,
  };
}

/** Same rule for the week's volume bars. */
export function weekQuery(day: string, options: DigestOptions) {
  const params = new URLSearchParams({ date: day });
  if (options.includeBulk) params.set("bulk", "1");

  return {
    queryKey: weekKey(day, options),
    queryFn: () => getJson<WeekDay[]>(`/api/week?${params}`),
    staleTime: Infinity,
  };
}

export function previousDay(day: string) {
  const date = new Date(`${day}T00:00:00`);
  date.setDate(date.getDate() - 1);
  return toDayString(date);
}
