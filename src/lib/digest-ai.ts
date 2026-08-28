import { createHash } from "node:crypto";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { listCache, readCache, writeCache } from "@/lib/ai-cache";
import type { DigestMessage, SignalMessage } from "@/lib/gmail";

/**
 * The four lanes a day of mail sorts into — the *kind* axis, not the urgency
 * one. Urgency is separate, because a bill and a colleague's question are
 * different sorts of thing that can both be due tomorrow.
 */
export const CATEGORIES = ["work", "meetings", "updates", "social"] as const;
export type Category = (typeof CATEGORIES)[number];

// Social is decided by Gmail's label before anything is fetched, so the model
// never sees it — confirming a label costs a call and adds nothing.
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
          "One plain sentence saying what the message actually says, at most sixteen words — or at most eight when the input is marked headlineOnly. Written to the reader as 'you'. No trailing period is required and no preamble like 'This email'.",
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
const PROMPT_VERSION = 6;

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
You have their sender, subject and snippet and nothing else. Do not invent
detail you cannot see and never mark one "high". Their blurb is at most eight
words, roughly half the length of the others, because these are scanned rather
than read and the card gives them one line. Write a whole phrase that fits in
eight words rather than the first eight words of a longer one.

The recap names what actually needs the reader today. Two sentences at the
very most, and shorter is better. Write plain declarative sentences. Never use
a colon, a semicolon, an em dash or a hyphen to bolt another clause onto a
sentence. If a thought needs more room, cut it instead. If nothing needs the
reader, say so in one sentence.

Return one item per input message, with ids copied exactly.`;

type CacheShape = { recap: string; items: z.infer<typeof InsightSchema>["items"] };

type CacheItem = z.infer<typeof InsightSchema>["items"][number];

// Per thread, not per day: keyed on the whole mailbox, one new message threw
// away every other answer and paid to compute them again.
type DayCache = {
  /** Prompt and model. A bump retires the whole file. */
  version: string;
  recap: string;
  /** What the recap was written against, so it is not reused for a new day. */
  recapHash: string;
  threads: Record<string, { hash: string; items: CacheItem[] }>;
};

const sha = (input: string) =>
  createHash("sha1").update(input).digest("hex").slice(0, 16);

const cacheFile = (day: string, timeZone = "server") =>
  `${day}-${timeZone.replace(/\//g, "-")}-threads.json`;

/** Messages that arrived as one conversation, keyed the way Gmail groups them. */
const threadOf = (message: DigestMessage) => message.threadId || message.id;

/** Sorted, so a thread hashes the same however the day is ordered. */
function threadHash(messages: DigestMessage[]) {
  return sha(
    messages
      .map((message) => `${message.id}:${message.unread ? "u" : "r"}`)
      .sort()
      .join(","),
  );
}

function groupThreads(messages: DigestMessage[]) {
  const threads = new Map<string, DigestMessage[]>();
  for (const message of messages) {
    const key = threadOf(message);
    const found = threads.get(key);
    if (found) found.push(message);
    else threads.set(key, [message]);
  }
  return threads;
}

/** Gmail's own tab label, for mail nobody has read. */
export function categoryFromLabel(message: DigestMessage): Category {
  if (message.tab === "promotions" || message.tab === "social") {
    return "social";
  }
  return "updates";
}

/**
 * A snippet, cut to one sentence, standing in for a blurb Claude never wrote.
 * `maxWords` keeps header-only mail to the one line its card gives it.
 */
function fallbackBlurb(message: DigestMessage, maxWords = 0) {
  const text = message.snippet.replace(/\s+/g, " ").trim();
  if (!text) return "";

  const sentence = text.match(/^[^.!?]{12,}?[.!?]/)?.[0];
  const value = sentence ?? text;

  if (maxWords) {
    const words = value.split(" ");
    return words.length <= maxWords
      ? value
      : `${words.slice(0, maxWords).join(" ").replace(/[,;:]$/, "")}…`;
  }

  return value.length > 120 ? `${value.slice(0, 117).trimEnd()}…` : value;
}

/** Header-only mail gets one line on the card, so its blurb is half as long. */
const HEADLINE_WORDS = 8;

// Subject for purpose, snippet for blurb, Gmail's labels for category. An
// unanswered invite is the one thing worth promoting without a model.
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
      blurb: fallbackBlurb(message, HEADLINE_WORDS),
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
  /**
   * What the page can honestly claim. Items missing from `cached` are filled
   * from heuristics, so a call that could not reach Claude must say so even
   * though some threads still carry real triage from an earlier one.
   */
  source: DayInsights["source"] = "claude",
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

  return { recap: tidyRecap(cached.recap), byId, source };
}

// Cached on disk against the messages and their read state, so a reload
// re-triages only what moved. Falls back to heuristics when Claude cannot run.
export async function fetchInsights(
  day: string,
  signal: SignalMessage[],
  bulk: DigestMessage[] = [],
  useAi = true,
  /** Part of the cache key: the same date is a different day in another zone. */
  timeZone?: string,
): Promise<DayInsights> {
  if (signal.length === 0 && bulk.length === 0) {
    return { recap: "Nothing arrived.", byId: {}, source: "heuristic" };
  }

  // Skip the cache too, or the switch would show a stale Claude result.
  if (!useAi) return heuristics(signal, bulk);

  const all: DigestMessage[] = [...signal, ...bulk];
  const threads = groupThreads(all);
  const hashes = new Map(
    [...threads].map(([key, messages]) => [key, threadHash(messages)]),
  );

  const version = `${PROMPT_VERSION}:${MODEL}`;
  const prior = await readCache<DayCache>(cacheFile(day, timeZone));
  const cache: DayCache =
    prior?.version === version
      ? prior
      : { version, recap: "", recapHash: "", threads: {} };

  // Only the threads whose messages or read state moved. Everything else keeps
  // the answer it already has.
  const stale = new Set(
    [...threads.keys()].filter(
      (key) => cache.threads[key]?.hash !== hashes.get(key),
    ),
  );
  // The recap covers the whole day, so it turns over when any thread does.
  const dayHash = sha(
    [...hashes]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, hash]) => `${key}=${hash}`)
      .join(","),
  );

  const settled = [...threads.keys()]
    .filter((key) => !stale.has(key))
    .flatMap((key) => cache.threads[key]?.items ?? []);

  // Nothing moved: the mailbox is the one already triaged.
  if (stale.size === 0 && cache.recapHash === dayHash) {
    return shape({ recap: cache.recap, items: settled }, signal, bulk);
  }

  if (!process.env.ANTHROPIC_API_KEY) return heuristics(signal, bulk);

  const fresh = (message: DigestMessage) => stale.has(threadOf(message));

  const payload = [
    ...signal.filter(fresh).map((message) => ({
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
    ...bulk.filter(fresh).map((message) => ({
      id: message.id,
      from: message.from,
      fromEmail: message.fromEmail,
      subject: message.subject,
      receivedOn: message.receivedAt.slice(0, 10),
      headlineOnly: true,
      snippet: message.snippet,
    })),
  ];

  // Context for the recap, not for re-triage.
  const context = settled.map((item) => ({
    from: all.find((message) => message.id === item.id)?.from ?? "",
    purpose: item.purpose,
    category: item.category,
    urgency: item.urgency,
    needsReply: item.needsReply,
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
          content: [
            `Triage these ${payload.length} messages from ${day}:`,
            JSON.stringify(payload, null, 1),
            context.length
              ? `\nThese ${context.length} were triaged earlier and have not changed. Do not return items for them. They are here so the recap can describe the whole day:\n${JSON.stringify(context, null, 1)}`
              : "",
          ].join("\n\n"),
        },
      ],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      console.warn("Claude did not return insights", response.stop_reason);
      return shape({ recap: cache.recap, items: settled }, signal, bulk, "heuristic");
    }

    const returned = new Map(
      response.parsed_output.items.map((item) => [item.id, item]),
    );
    const next: DayCache["threads"] = {};
    for (const [key, messages] of threads) {
      next[key] = stale.has(key)
        ? {
            hash: hashes.get(key) ?? "",
            items: messages
              .map((message) => returned.get(message.id))
              .filter((item): item is CacheItem => Boolean(item)),
          }
        : cache.threads[key];
    }

    const value: DayCache = {
      version,
      recap: response.parsed_output.recap,
      recapHash: dayHash,
      threads: next,
    };
    await writeCache(cacheFile(day, timeZone), value);

    const items = Object.values(next).flatMap((thread) => thread.items);
    return shape({ recap: value.recap, items }, signal, bulk);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.warn("ANTHROPIC_API_KEY rejected; using heuristics");
    } else if (/credit balance/i.test((error as Error)?.message ?? "")) {
      // Arrives as a plain 400, so it needs matching on the message.
      console.warn("Anthropic credit balance exhausted; using heuristics");
    } else if (error instanceof Anthropic.RateLimitError) {
      console.warn("Rate limited by the Claude API; using heuristics");
    } else {
      console.error("Claude triage failed", error);
    }
    // Threads that were already triaged keep their answers; `shape` fills the
    // rest from heuristics rather than throwing the whole day away.
    return shape({ recap: cache.recap, items: settled }, signal, bulk, "heuristic");
  }
}

/** One message's insight off the day's cache file, or null if never opened. */
export async function readCachedInsight(
  day: string,
  id: string,
): Promise<Insight | null> {
  // The detail page does not know the reader's zone, and the id is unique
  // whichever zone's file holds it, so take whichever day-file has it.
  for (const file of await listCache(`${day}-`)) {
    const cached = await readCache<DayCache>(file);
    const item = Object.values(cached?.threads ?? {})
      .flatMap((thread) => thread.items)
      .find((entry) => entry.id === id);
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
