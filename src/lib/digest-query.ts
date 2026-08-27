import { keepPreviousData } from "@tanstack/react-query";

import { toDayString } from "@/lib/day";
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
 * Show what we have, then check. A day opened before paints instantly from the
 * persisted cache and the refetch happens behind it rather than in front of a
 * skeleton — for every day, not just today: mail can be deleted, archived or
 * read long after it arrived, and a May digest that still lists a message you
 * threw away in August is simply wrong.
 */
export function dayQuery(day: string, options: DigestOptions) {
  const params = new URLSearchParams({ date: day });
  if (!options.useAi) params.set("ai", "0");

  return {
    queryKey: dayKey(day, options),
    queryFn: () => getJson<DayDigest>(`/api/digest?${params}`),
    staleTime: 0,
    // Jumping to an untriaged day used to tear the page down to a skeleton and
    // build it back, which from the date picker reads as the screen falling
    // over. The day you were reading stays up, dimmed, until the new one is
    // ready — only the very first load has nothing to hold.
    placeholderData: keepPreviousData,
  };
}

/**
 * Same rule for the week's volumes, plus one: the previous window's counts
 * stand in while the next load, so moving the rail never blanks it back to a
 * skeleton above content that is itself reloading.
 */
export function weekQuery(anchor: string) {
  const params = new URLSearchParams({ start: anchor });

  return {
    queryKey: weekKey(anchor),
    queryFn: () => getJson<WeekDay[]>(`/api/week?${params}`),
    // Counts move whenever mail does, which includes mail leaving a past day.
    staleTime: 0,
    placeholderData: keepPreviousData,
  };
}

export function previousDay(day: string) {
  const date = new Date(`${day}T00:00:00`);
  date.setDate(date.getDate() - 1);
  return toDayString(date);
}
