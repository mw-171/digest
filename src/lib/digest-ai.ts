import { createHash } from "node:crypto";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { listCache, readCache, writeCache } from "@/lib/ai-cache";
import type { DigestMessage, SignalMessage } from "@/lib/gmail";

/**
 * The four lanes a day of mail sorts into.
 *
 * This is the *kind* axis, not the urgency one — what a message is, not how
 * much it wants. Urgency is a separate field, because a bill and a colleague's
 * question are different sorts of thing that can both be due tomorrow.
 */
export const CATEGORIES = ["work", "meetings", "updates", "social"] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * The three the model actually chooses between. Social is whatever Gmail has
 * already filed under promotions or social, and it is decided before any of it
 * is fetched — asking Claude to confirm a label costs a round trip to learn
 * what the label already said.
 */
export const TRIAGE_CATEGORIES = ["work", "meetings", "updates"] as const;

/**
 * How soon a message matters. The list below the tiles is sorted on this, so
 * it is the field that decides what a person reads first.
 */
export const URGENCIES = ["high", "normal", "low"] as const;
export type Urgency = (typeof URGENCIES)[number];

/** Lower sorts first. */
export const URGENCY_RANK: Record<Urgency, number> = {
  high: 0,
  normal: 1,
  low: 2,
};

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
      blurb: z
        .string()
        .describe(
          "One plain sentence, at most sixteen words, saying what the message actually says. Written to the reader as 'you'. No trailing period is required and no preamble like 'This email'.",
        ),
      category: z.enum(TRIAGE_CATEGORIES),
      urgency: z.enum(URGENCIES),
      needsReply: z
        .boolean()
        .describe("True when the reader has to do, answer or decide something."),
      due: z
        .string()
        .describe(
          'The date the message turns on, as YYYY-MM-DD. Resolve anything relative — "Friday", "tomorrow", "end of the week" — against the date the message was received, which is given with it. Empty string when it names no date.',
        ),
      dueKind: z
        .enum(["deadline", "event", "none"])
        .describe(
          'What that date is: "deadline" when the reader has to act by it, "event" when it is simply when something is scheduled to happen, "none" when there is no date.',
        ),
    }),
  ),
});

export type DueKind = "deadline" | "event" | "none";

export type Insight = {
  /** What the message is for, in about six words. Replaces the subject. */
  purpose: string;
  /** One sentence on what it says. What the card shows under the sender. */
  blurb: string;
  /** The date the message turns on, `YYYY-MM-DD`, or "". */
  due: string;
  /** Whether that date is something to act by, or just when it happens. */
  dueKind: DueKind;
  category: Category;
  urgency: Urgency;
  needsReply: boolean;
};

export type DayInsights = {
  recap: string;
  byId: Record<string, Insight>;
  source: "claude" | "heuristic";
};

const MODEL = "claude-opus-5";
// Bump when the prompt or schema changes so old cache entries are ignored.
const PROMPT_VERSION = 5;

const SYSTEM = `You triage one day of a person's Gmail for a daily digest.

For every message, write two things.

"purpose" — what the message is for, in at most six words, from the reader's
point of view. It replaces the subject line in the UI, so make it concrete:
"Approve two contract clauses", "$4,182 payout on its way", "Dentist booked,
3 Sept 10:15". Never pad it to a sentence and never add a trailing period.

"blurb" — one plain sentence, at most sixteen words, saying what the message
actually says. This is the line shown under the sender's name on the card, so
it must carry the detail the purpose line had no room for: the amount, the
date, the name, the ask. Write it to the reader as "you". Never begin with
"This email" or "The sender".

Sort each message into exactly one category:
- "work" — something the reader has to do, decide, answer or act on. Direct
  questions, requests, reviews, approvals, signatures, anything from a real
  person addressed to them.
- "meetings" — anything about a scheduled event: calendar invitations, invites
  and reschedules, cancellations, agendas, meeting notes and minutes, recaps
  and recordings of a call that happened.
- "updates" — things that happened and are worth knowing but ask nothing:
  receipts, invoices, statements, bills, payment and delivery confirmations,
  account and security notices, automated reports, newsletters and mailing
  lists the reader subscribed to.

A calendar invitation is always "meetings", even when it needs an RSVP. A bill
that must be paid by a date is still "updates" — it is a statement, and its
deadline is carried by the due date rather than by the category.

Then set "urgency", which is how soon the message matters. It decides the
order the reader sees things in, so be decisive rather than generous:
- "high" — needs the reader today or tomorrow: a person waiting on an answer,
  a deadline inside a couple of days, an unanswered invitation for a meeting
  that is nearly here, a failed payment, a security alert.
- "normal" — real mail that matters this week but not this hour.
- "low" — nothing is being asked and nothing is time-bound: routine receipts,
  automated reports, newsletters, notifications.

Set "needsReply" true only when the reader has to do, answer or decide
something themselves. A receipt does not need a reply however important it is.

Set "due" only when the message names a date, and always as YYYY-MM-DD. Each
message comes with the date it was received — use it to resolve anything
relative, so "by Friday" in a message received on 2026-08-25 becomes
2026-08-28. Never guess a date the message does not state.

Then say which kind of date it is. "deadline" is a date the reader has to act
by: a payment due, a form to return, an RSVP to answer. "event" is a date
something simply happens on: a meeting, a delivery, a flight, an appointment
already booked. The distinction is shown to the reader, so a dentist
appointment is an event and the invoice that pays for it is a deadline.

Some messages are given to you as headers only, marked "headlineOnly": true.
You have their sender, subject and snippet and nothing else. Write a shorter,
plainer blurb for those from what the subject says, do not invent detail you
cannot see, and never mark one "high".

The recap names what actually needs the reader today. Two sentences at the
very most, and shorter is better. Write plain declarative sentences. Never use
a colon, a semicolon, an em dash or a hyphen to bolt another clause onto a
sentence. If a thought needs more room, cut it instead. If nothing needs the
reader, say so in one sentence.

Return one item per input message, with ids copied exactly.`;

type CacheShape = { recap: string; items: z.infer<typeof InsightSchema>["items"] };

function cacheKey(day: string, ids: string[]) {
  const digest = createHash("sha1")
    .update(`${PROMPT_VERSION}:${MODEL}:${ids.join(",")}`)
    .digest("hex")
    .slice(0, 16);
  return `${day}-${digest}.json`;
}

/**
 * Where a message sits when nobody has read it: Gmail's own tab label.
 *
 * Promotions and social are advertising by definition. Forums is the mailing
 * list tab, which belongs with the other things that arrive on a schedule and
 * ask nothing.
 */
export function categoryFromLabel(message: DigestMessage): Category {
  if (message.tab === "promotions" || message.tab === "social") {
    return "social";
  }
  return "updates";
}

/** A snippet, cut to one sentence, standing in for a blurb Claude never wrote. */
function fallbackBlurb(message: DigestMessage) {
  const text = message.snippet.replace(/\s+/g, " ").trim();
  if (!text) return "";
  const sentence = text.match(/^[^.!?]{12,}?[.!?]/)?.[0];
  const value = sentence ?? text;
  return value.length > 120 ? `${value.slice(0, 117).trimEnd()}…` : value;
}

/**
 * What we show when Claude is unavailable: the subject stands in for the
 * purpose, the snippet for the blurb, and Gmail's labels for the category.
 * An unanswered invitation is the one thing worth promoting without a model
 * to read the mail.
 */
function heuristics(
  signal: SignalMessage[],
  bulk: DigestMessage[],
): DayInsights {
  const byId: Record<string, Insight> = {};

  for (const message of signal) {
    // An invitation nobody has answered is the one thing labels can settle.
    const rsvp = message.invite?.status === "needs-action";
    const important = message.unread && message.labels.includes("IMPORTANT");

    const category: Category = message.invite
      ? "meetings"
      : message.tab === "updates" || message.tab === "forums"
        ? "updates"
        : "work";

    byId[message.id] = {
      purpose: message.subject,
      blurb: fallbackBlurb(message),
      due: message.invite ? message.invite.start.slice(0, 10) : "",
      dueKind: message.invite ? "event" : "none",
      category,
      urgency: rsvp || important ? "high" : category === "updates" ? "low" : "normal",
      needsReply: rsvp || important,
    };
  }

  for (const message of bulk) {
    byId[message.id] = {
      purpose: message.subject,
      blurb: fallbackBlurb(message),
      due: "",
      dueKind: "none",
      category: categoryFromLabel(message),
      urgency: "low",
      needsReply: false,
    };
  }

  const waiting = Object.values(byId).filter((i) => i.needsReply).length;
  const recap = signal.length
    ? `${signal.length} arrived. ${waiting || "None"} look like they need you.`
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

function shape(
  cached: CacheShape,
  signal: SignalMessage[],
  bulk: DigestMessage[],
): DayInsights {
  const fallback = heuristics(signal, bulk);
  const byId = { ...fallback.byId };
  const labelled = new Set(bulk.map((message) => message.id));

  for (const item of cached.items) {
    const base = byId[item.id];
    if (!base) continue; // ignore ids Claude invented

    byId[item.id] = {
      purpose: item.purpose.trim() || base.purpose,
      blurb: item.blurb.trim().replace(/\.$/, "") || base.blurb,
      // Anything that isn't a plain date is dropped rather than shown: a bare
      // weekday is ambiguous the moment you browse back a week.
      due: /^\d{4}-\d{2}-\d{2}$/.test(item.due.trim()) ? item.due.trim() : "",
      dueKind: item.dueKind,
      // Bulk mail keeps the category its Gmail label gave it. The model only
      // ever saw its subject line, and the label saw the whole mailbox.
      category: labelled.has(item.id) ? base.category : item.category,
      urgency: labelled.has(item.id) ? "low" : item.urgency,
      needsReply: labelled.has(item.id) ? false : item.needsReply,
    };
  }

  return { recap: tidyRecap(cached.recap), byId, source: "claude" };
}

/**
 * Purpose lines, card blurbs, categories, urgencies, deadlines and a recap for
 * one day, from Claude. Cached per day on disk, keyed by the exact set of
 * message ids, so revisiting a day costs nothing.
 *
 * Both halves of the day are sent, but not equally: signal arrives with its
 * body, bulk with nothing but the headers Gmail hands over free. The second
 * list is there so every card in the UI has a written line under the sender
 * rather than a raw subject, and it costs a few hundred tokens on a call that
 * was already being made.
 *
 * Falls back to {@link heuristics} when `useAi` is off, when there's no API
 * key, or when the call fails — the digest still renders, just less sharply.
 */
export async function fetchInsights(
  day: string,
  signal: SignalMessage[],
  bulk: DigestMessage[] = [],
  useAi = true,
): Promise<DayInsights> {
  if (signal.length === 0 && bulk.length === 0) {
    return { recap: "Nothing arrived.", byId: {}, source: "heuristic" };
  }

  // AI switched off: skip the cache too, so what you see is always the
  // heuristic pass rather than a stale Claude result from an earlier visit.
  if (!useAi) return heuristics(signal, bulk);

  const ids = [...signal, ...bulk].map((message) => message.id);
  const key = cacheKey(day, ids);
  const cached = await readCache<CacheShape>(key);
  if (cached) return shape(cached, signal, bulk);

  if (!process.env.ANTHROPIC_API_KEY) return heuristics(signal, bulk);

  const payload = [
    ...signal.map((message) => ({
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
    })),
    ...bulk.map((message) => ({
      id: message.id,
      from: message.from,
      fromEmail: message.fromEmail,
      subject: message.subject,
      receivedOn: message.receivedAt.slice(0, 10),
      headlineOnly: true,
      snippet: message.snippet,
    })),
  ];

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
          content: `Triage these ${payload.length} messages from ${day}:\n\n${JSON.stringify(payload, null, 1)}`,
        },
      ],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      console.warn("Claude did not return insights", response.stop_reason);
      return heuristics(signal, bulk);
    }

    const value: CacheShape = {
      recap: response.parsed_output.recap,
      items: response.parsed_output.items,
    };
    await writeCache(key, value);
    return shape(value, signal, bulk);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.warn("ANTHROPIC_API_KEY rejected; using heuristics");
    } else if (error instanceof Anthropic.RateLimitError) {
      console.warn("Rate limited by the Claude API; using heuristics");
    } else {
      console.error("Claude triage failed", error);
    }
    return heuristics(signal, bulk);
  }
}

/**
 * The insight already computed for one message, read straight off the day's
 * cache file. Lets the detail view show the purpose line and the category chip
 * without re-triaging the whole day; returns null if the day was never opened.
 */
export async function readCachedInsight(
  day: string,
  id: string,
): Promise<Insight | null> {
  for (const file of await listCache(`${day}-`)) {
    const cached = await readCache<CacheShape>(file);
    const item = cached?.items.find((entry) => entry.id === id);
    if (item) {
      return {
        purpose: item.purpose,
        blurb: item.blurb,
        due: item.due,
        dueKind: item.dueKind,
        category: item.category,
        urgency: item.urgency,
        needsReply: item.needsReply,
      };
    }
  }
  return null;
}
