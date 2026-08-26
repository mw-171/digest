import { createHash } from "node:crypto";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { listCache, readCache, writeCache } from "@/lib/ai-cache";
import type { SignalMessage } from "@/lib/gmail";

/**
 * The urgency axis. Only the first two are the model's to decide: noise is
 * whatever Gmail already filed under promotions, social or forums, and it
 * never reaches the model at all.
 */
export const TRIAGE_BANDS = ["needs", "fyi"] as const;
export const BANDS = [...TRIAGE_BANDS, "noise"] as const;
export type Band = (typeof BANDS)[number];

const InsightSchema = z.object({
  recap: z
    .string()
    .describe(
      "At most two short sentences summarising the day. No greeting, no colons, no semicolons, no dashes.",
    ),
  items: z.array(
    z.object({
      id: z.string().describe("The message id, copied exactly from the input."),
      purpose: z
        .string()
        .describe(
          "What this message is for, at most six words. Replaces the subject line, so do not repeat it verbatim when the subject is vague.",
        ),
      due: z
        .string()
        .describe(
          'The date the message asks for, as YYYY-MM-DD. Resolve anything relative — "Friday", "tomorrow", "end of the week" — against the date the message was received, which is given with it. Empty string when it names no date.',
        ),
      band: z.enum(TRIAGE_BANDS),
    }),
  ),
});

export type Insight = {
  purpose: string;
  /** A deadline as `YYYY-MM-DD`, or "". Formatted for display by `day.ts`. */
  due: string;
  band: Band;
};

export type DayInsights = {
  recap: string;
  byId: Record<string, Insight>;
  source: "claude" | "heuristic";
};

const MODEL = "claude-opus-5";
// Bump when the prompt or schema changes so old cache entries are ignored.
const PROMPT_VERSION = 3;

const SYSTEM = `You triage one day of a person's Gmail for a daily digest.

For every message, write a "purpose": what the message is for, in at most six
words, from the reader's point of view. It replaces the subject line in the UI,
so make it concrete — "Approve two contract clauses", "$4,182 payout on its
way", "Dentist booked, 3 Sept 10:15". Never pad it to a sentence and never add
a trailing period.

Sort each message into exactly one band:
- "needs" — the reader has to do or decide something: a direct question, a
  request, a signature, a payment, an RSVP they have not answered, a hard
  deadline.
- "fyi" — something happened or is scheduled and the reader should know, but
  nothing is being asked of them: receipts, confirmations, deliveries,
  automated reports, invitations they have already accepted.

A message from a real person addressed to the reader is almost always "needs".
Automated mail is only "needs" when it demands action by a date (a failed
payment, an expiring card, an unanswered invitation).

Set "due" only when the message names a date the reader has to act by, and
always as YYYY-MM-DD. Each message comes with the date it was received — use it
to resolve anything relative, so "by Friday" in a message received on
2026-08-25 becomes 2026-08-28. Never guess a date the message does not state.

The recap names what actually needs the reader today. Two sentences at the
very most, and shorter is better. Write plain declarative sentences. Never use
a colon, a semicolon, an em dash or a hyphen to bolt another clause onto a
sentence. If a thought needs more room, cut it instead. If nothing needs the
reader, say so in one sentence.

Return one item per input message, with ids copied exactly.`;

type CacheShape = { recap: string; items: z.infer<typeof InsightSchema>["items"] };

function cacheKey(day: string, messages: SignalMessage[]) {
  const digest = createHash("sha1")
    .update(`${PROMPT_VERSION}:${MODEL}:${messages.map((m) => m.id).join(",")}`)
    .digest("hex")
    .slice(0, 16);
  return `${day}-${digest}.json`;
}

/**
 * What we show when Claude is unavailable: the subject stands in for the
 * purpose, and an unanswered invitation is the one thing worth promoting
 * without a model to read the mail.
 */
function heuristics(messages: SignalMessage[]): DayInsights {
  const byId: Record<string, Insight> = {};

  for (const message of messages) {
    // An invitation nobody has answered is the one thing labels can settle.
    const rsvp = message.invite?.status === "needs-action";
    const needs =
      rsvp || (message.unread && message.labels.includes("IMPORTANT"));

    byId[message.id] = {
      purpose: message.subject,
      due: message.invite && !message.invite.allDay ? message.invite.start.slice(0, 10) : "",
      band: needs ? "needs" : "fyi",
    };
  }

  const needsCount = Object.values(byId).filter((i) => i.band === "needs").length;
  const recap = messages.length
    ? `${messages.length} arrived. ${needsCount || "None"} look like they need you.`
    : "Nothing arrived.";

  return { recap, byId, source: "heuristic" };
}

/**
 * Two sentences, no more. The prompt asks for it; this makes it true even when
 * the model gets carried away.
 */
export function tidyRecap(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  const sentences = clean.match(/[^.!?]+[.!?]+(?=\s|$)/g);
  if (!sentences) return clean;
  return sentences
    .slice(0, 2)
    .map((sentence) => sentence.trim())
    .join(" ");
}

function shape(cached: CacheShape, messages: SignalMessage[]): DayInsights {
  const fallback = heuristics(messages);
  const byId = { ...fallback.byId };

  for (const item of cached.items) {
    if (!byId[item.id]) continue; // ignore ids Claude invented
    byId[item.id] = {
      purpose: item.purpose.trim() || byId[item.id].purpose,
      // Anything that isn't a plain date is dropped rather than shown: a bare
      // weekday is ambiguous the moment you browse back a week.
      due: /^\d{4}-\d{2}-\d{2}$/.test(item.due.trim()) ? item.due.trim() : "",
      band: item.band,
    };
  }

  return { recap: tidyRecap(cached.recap), byId, source: "claude" };
}

/**
 * Purpose lines, deadlines, urgency bands and a recap for one day, from Claude.
 * Cached per day on disk, keyed by the exact set of message ids, so revisiting
 * a day costs nothing. Falls back to {@link heuristics} when `useAi` is off,
 * when there's no API key, or when the call fails — the digest still renders, just less sharply.
 */
export async function fetchInsights(
  day: string,
  messages: SignalMessage[],
  useAi = true,
): Promise<DayInsights> {
  if (messages.length === 0) {
    return { recap: "Nothing arrived.", byId: {}, source: "heuristic" };
  }

  // AI switched off: skip the cache too, so what you see is always the
  // heuristic pass rather than a stale Claude result from an earlier visit.
  if (!useAi) return heuristics(messages);

  const key = cacheKey(day, messages);
  const cached = await readCache<CacheShape>(key);
  if (cached) return shape(cached, messages);

  if (!process.env.ANTHROPIC_API_KEY) return heuristics(messages);

  const payload = messages.map((message) => ({
    id: message.id,
    from: message.from,
    fromEmail: message.fromEmail,
    subject: message.subject,
    receivedOn: message.receivedAt.slice(0, 10),
    unread: message.unread,
    // The body, not just the snippet: a deadline is rarely in the first line.
    body: message.text || message.snippet,
    invite: message.invite
      ? {
          starts: message.invite.start,
          location: message.invite.location,
          yourReply: message.invite.status,
          cancelled: message.invite.cancelled,
        }
      : undefined,
  }));

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: zodOutputFormat(InsightSchema),
      },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Triage these ${messages.length} messages from ${day}:\n\n${JSON.stringify(payload, null, 1)}`,
        },
      ],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      console.warn("Claude did not return insights", response.stop_reason);
      return heuristics(messages);
    }

    const value: CacheShape = {
      recap: response.parsed_output.recap,
      items: response.parsed_output.items,
    };
    await writeCache(key, value);
    return shape(value, messages);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.warn("ANTHROPIC_API_KEY rejected; using heuristics");
    } else if (error instanceof Anthropic.RateLimitError) {
      console.warn("Rate limited by the Claude API; using heuristics");
    } else {
      console.error("Claude triage failed", error);
    }
    return heuristics(messages);
  }
}

/**
 * The insight already computed for one message, read straight off the day's
 * cache file. Lets the detail view show the purpose line without re-triaging
 * the whole day; returns null if the day was never opened.
 */
export async function readCachedInsight(
  day: string,
  id: string,
): Promise<Insight | null> {
  for (const file of await listCache(`${day}-`)) {
    const cached = await readCache<CacheShape>(file);
    const item = cached?.items.find((entry) => entry.id === id);
    if (item) {
      return { purpose: item.purpose, due: item.due, band: item.band };
    }
  }
  return null;
}
