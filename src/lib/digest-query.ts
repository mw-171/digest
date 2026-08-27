import { keepPreviousData } from "@tanstack/react-query";

import { toDayString } from "@/lib/day";
import type { DayDigest, WeekDay } from "@/lib/digest";

export type DigestOptions = { useAi: boolean };

// Bump on any payload shape change: the persisted cache is thrown away rather
// than rehydrated into a UI that no longer understands it.
export const CACHE_VERSION = "5";

export const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

export const dayKey = (day: string, options: DigestOptions) =>
  ["day", day, options.useAi ? "ai" : "plain"] as const;

// Keyed on the window, not the day, so stepping between days inside one reads
// a single cached answer and the pills never blink.
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

// Show what we have, then check — every day, not just today. Mail can be
// deleted or read long after it arrived.
export function dayQuery(day: string, options: DigestOptions) {
  const params = new URLSearchParams({ date: day });
  if (!options.useAi) params.set("ai", "0");

  return {
    queryKey: dayKey(day, options),
    queryFn: () => getJson<DayDigest>(`/api/digest?${params}`),
    staleTime: 0,
    // The day you were reading stays up, dimmed, until the new one is ready.
    placeholderData: keepPreviousData,
  };
}

export function weekQuery(anchor: string) {
  const params = new URLSearchParams({ start: anchor });

  return {
    queryKey: weekKey(anchor),
    queryFn: () => getJson<WeekDay[]>(`/api/week?${params}`),
    staleTime: 0,
    placeholderData: keepPreviousData,
  };
}

export function previousDay(day: string) {
  const date = new Date(`${day}T00:00:00`);
  date.setDate(date.getDate() - 1);
  return toDayString(date);
}
