import { keepPreviousData } from "@tanstack/react-query";

import { toDayString } from "@/lib/day";
import type { DayDigest, WeekDay } from "@/lib/digest";
import type { ReplyDraft } from "@/lib/draft-ai";
import type { DraftingVoice, Voice } from "@/lib/voice";

export type DigestOptions = { useAi: boolean };

/**
 * The reader's IANA zone, which decides where a day starts. Sent with every
 * request because the server's own midnight is not theirs — on Vercel it is
 * UTC, which files an evening's mail under tomorrow.
 */
export function timeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

// Bump on any payload shape change: the persisted cache is thrown away rather
// than rehydrated into a UI that no longer understands it.
export const CACHE_VERSION = "6";

export const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

// The zone is part of the key: the same date is a different set of mail in
// another zone, and a persisted cache can outlive a flight.
export const dayKey = (day: string, options: DigestOptions) =>
  ["day", day, options.useAi ? "ai" : "plain", timeZone()] as const;

// Keyed on the window, not the day, so stepping between days inside one reads
// a single cached answer and the pills never blink.
export const weekKey = (anchor: string) =>
  ["week", anchor, timeZone()] as const;

// No zone and no date: the voice is read across whatever you last sent, not
// inside a day, so it is the same answer wherever you open it.
export const voiceKey = () => ["voice"] as const;

/**
 * A short stable id for a voice. The draft is cached against it, so re-reading
 * your voice writes a new draft and re-reading the same one does not.
 */
function fingerprint(value: unknown) {
  const text = JSON.stringify(value);
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(36);
}

export const draftKey = (id: string, voiceId: string) =>
  ["draft", id, voiceId] as const;

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

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });

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

const getJson = <T,>(url: string) => request<T>(url);

const postJson = <T,>(url: string, body: unknown) =>
  request<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

// Show what we have, then check — every day, not just today. Mail can be
// deleted or read long after it arrived.
export function dayQuery(day: string, options: DigestOptions) {
  const params = new URLSearchParams({ date: day });
  if (!options.useAi) params.set("ai", "0");
  if (timeZone()) params.set("tz", timeZone());

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
  if (timeZone()) params.set("tz", timeZone());

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

/**
 * How you write, read off your own sent mail. Never stale, so it is fetched
 * once and then read from the cache on every later visit, across reloads too.
 * The answer moves only when you send more mail, and re-reading it sweeps
 * fifty messages out of Gmail even when Claude's half is already cached, so
 * the only thing that asks for it again is the Read again button.
 */
export function voiceQuery() {
  return {
    queryKey: voiceKey(),
    queryFn: () => getJson<Voice>("/api/voice"),
    staleTime: Infinity,
    // Outlives the tab: a query dropped from memory while you read the digest
    // would fetch again on the way back.
    gcTime: Infinity,
  };
}

/**
 * A reply to one message, written in your voice. The voice travels in the
 * request rather than being read on the server: the server has nowhere to keep
 * it in production, and re-reading it would sweep fifty sent emails out of
 * Gmail every time you asked for a draft. The browser already holds one.
 *
 * Cached against the message and the voice together, and never stale, so a
 * draft is written once and read from the cache every time after.
 */
const drafting = (voice: Voice): DraftingVoice => ({
  profile: voice.profile,
  medianWords: voice.stats.medianWords,
});

export function draftQuery(id: string, voice: Voice | undefined) {
  const body = voice && drafting(voice);

  return {
    queryKey: draftKey(id, body ? fingerprint(body) : ""),
    queryFn: () => postJson<ReplyDraft>("/api/draft", { id, voice: body }),
    // Nothing to write in until the voice has landed.
    enabled: Boolean(body && body.profile.summary.length > 0),
    staleTime: Infinity,
    gcTime: Infinity,
  };
}

/**
 * The same request with the cache stepped over on both sides, for the one case
 * where the point is a different answer to the same question. The caller writes
 * the result into the draft's cache entry, so the new one is the one kept.
 */
export function regenerateDraft(id: string, voice: Voice) {
  return postJson<ReplyDraft>("/api/draft", {
    id,
    voice: drafting(voice),
    regenerate: true,
  });
}
