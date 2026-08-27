import { keepPreviousData } from "@tanstack/react-query";

import { toDayString, windowFrom } from "@/lib/day";
import type { DayDigest, WeekDay } from "@/lib/digest";

export type DigestOptions = { useAi: boolean };

/**
 * Bumped whenever the shape of a cached payload changes. The persisted cache
 * is thrown away rather than rehydrated into a UI that no longer understands
 * it — a stored digest from before `dueKind` existed would render dates that
 * cannot be labelled.
 */
export const CACHE_VERSION = "5";

/** How long a persisted digest is worth restoring before it is just history. */
export const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

export const dayKey = (day: string, options: DigestOptions) =>
  ["day", day, options.useAi ? "ai" : "plain"] as const;

/**
 * Keyed on the window, which is what the counts are actually for. Stepping
 * between days inside one window reads a single cached answer, so the pills
 * never blink; the key only changes when the rail itself moves.
 */
export const weekKey = (anchor: string) => ["week", anchor] as const;

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
 * Show what we have, then check.
 *
 * The cache is persisted to localStorage, so a day you have opened before
 * paints immediately — on a reload too, not just while paging around. Today is
 * marked stale the moment it mounts, so that paint is followed by a quiet
 * refetch and the mailbox still gets re-read on every reload; the difference
 * is that you read yesterday's answer while it happens instead of a skeleton.
 *
 * A past day is settled — no more mail can arrive into it — so it is not
 * rechecked at all within the cache's lifetime.
 *
 * The AI setting is part of the key, so flipping the toggle swaps between
 * cached views of the same day rather than throwing either of them away.
 */
export function dayQuery(day: string, today: string, options: DigestOptions) {
  const params = new URLSearchParams({ date: day });
  if (!options.useAi) params.set("ai", "0");

  return {
    queryKey: dayKey(day, options),
    queryFn: () => getJson<DayDigest>(`/api/digest?${params}`),
    staleTime: day === today ? 0 : CACHE_MAX_AGE,
    // Jumping to an untriaged day used to tear the page down to a skeleton and
    // build it back, which from the date picker reads as the screen falling
    // over. The day you were reading stays up, dimmed, until the new one is
    // ready — only the very first load has nothing to hold.
    placeholderData: keepPreviousData,
  };
}

/**
 * Same rule for the week's volume bars, plus one: the previous week's bars
 * stand in while the next ones load.
 *
 * Picking a day changes the query key, which would otherwise blank the strip
 * back to a skeleton — a whole block of chrome flickering above content that
 * is itself reloading. The bars barely move between neighbouring days, so
 * holding the old ones is both calmer and truer.
 */
export function weekQuery(anchor: string, today: string) {
  const params = new URLSearchParams({ start: anchor });

  return {
    queryKey: weekKey(anchor),
    queryFn: () => getJson<WeekDay[]>(`/api/week?${params}`),
    // A window reaching today can still gain mail; one entirely in the past
    // cannot.
    staleTime: windowFrom(anchor).includes(today) ? 0 : CACHE_MAX_AGE,
    placeholderData: keepPreviousData,
  };
}

export function previousDay(day: string) {
  const date = new Date(`${day}T00:00:00`);
  date.setDate(date.getDate() - 1);
  return toDayString(date);
}
