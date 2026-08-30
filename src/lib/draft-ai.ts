import { createHash } from "node:crypto";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { readCache, writeCache } from "@/lib/ai-cache";
import { logCacheUsage } from "@/lib/ai-usage";
import type { FullMessage } from "@/lib/gmail";
import type { DraftingVoice } from "@/lib/voice";

/**
 * A reply, written in your own voice rather than a model's. Gmail is connected
 * read-only, so nothing here is saved as a draft — this is text to copy, and
 * the honesty about that belongs in the UI, not in the prompt.
 */
const DraftSchema = z.object({
  body: z
    .string()
    .describe(
      "The reply itself, ready to copy: greeting, body and sign-off, exactly as it would be sent. Plain text with blank lines between paragraphs. No subject line, no markdown, no square-bracket instructions except the placeholders you are told to leave.",
    ),
  notes: z
    .array(z.string())
    .describe(
      "Up to two short lines naming what you had to assume or leave for the reader to fill in, e.g. 'Left the date blank — you know when you are free'. Empty when the reply needed nothing you did not have. No trailing periods.",
    ),
});

export type ReplyDraft = z.infer<typeof DraftSchema> & {
  /** "none" when Claude could not be reached, so the page can say so. */
  source: "claude" | "none";
};

const EMPTY: ReplyDraft = { body: "", notes: [], source: "none" };

const MODEL = "claude-opus-5";
// Bump when the prompt or the schema changes so old entries are ignored.
const PROMPT_VERSION = 1;

const SYSTEM = `You write one reply to one email, in the voice of the person
who received it.

You are given a description of how they write, read from their own sent mail:
their openings, their sign-offs, their habits, the phrases they reach for and
the things that never appear in their writing. Follow it exactly. It beats
every instinct you have about how a helpful email should read. If they open
with no greeting, open with no greeting. If they sign off "thanks!" in lower
case, write it in lower case. If they never use em dashes or exclamation
marks, do not use them.

Match their length. You are told the median length of their emails in words;
a reply that is three times that is not theirs however well written it is.
Most replies are shorter than the model's instinct.

Answer the email. Say the thing that is actually being asked for, and say it
first — do not open with a paragraph of acknowledgement before getting to it.

Never invent a fact. Not a date, not a time, not a number, not a name, not a
commitment, not an opinion about something you cannot see. Where the reply
needs something only the reader knows, leave a short square-bracket
placeholder like [date] or [number], keep it to a few words, and name it in
"notes". A reply with one honest gap in it is useful; a reply with a
confident invention in it is worse than nothing.

Write only the reply. No subject line, no "Here is a draft", no markdown, no
commentary. Blank lines between paragraphs and nothing else for formatting
unless their habits say they use lists.`;

const MAX_BODY = 12_000;

const sha = (input: string) =>
  createHash("sha1").update(input).digest("hex").slice(0, 16);

/**
 * Keyed on the message and the voice together, so a re-read voice writes a new
 * draft and reopening the same page does not pay twice.
 */
function cacheKey(id: string, body: string, voice: DraftingVoice) {
  return `draft-${id}-${sha(`${PROMPT_VERSION}:${MODEL}:${body}:${JSON.stringify(voice)}`)}.json`;
}

/** The voice as the model sees it: only the parts that decide how words land. */
function describe(voice: DraftingVoice) {
  const { profile, medianWords } = voice;

  return {
    howTheyWrite: profile.summary,
    traits: profile.traits.map((trait) => `${trait.label}: ${trait.detail}`),
    theyOpenWith: profile.openings,
    theyCloseWith: profile.signoffs,
    habits: profile.habits,
    phrasesTheyUse: profile.phrases,
    neverTheirs: profile.avoid,
    howItShifts: profile.registers.map(
      (register) => `${register.audience}: ${register.detail}`,
    ),
    medianLengthInWords: medianWords,
  };
}

/**
 * A reply to `message`, written in `voice`. Cached on disk against both.
 * Returns `source: "none"` with no API key or on failure, and the page says so
 * rather than showing a draft nobody wrote.
 */
export async function draftReply(
  message: FullMessage,
  bodyText: string,
  voice: DraftingVoice,
  /** Write a new one rather than return the one already written. */
  { fresh = false }: { fresh?: boolean } = {},
): Promise<ReplyDraft> {
  const body = bodyText.slice(0, MAX_BODY).trim() || message.snippet;
  if (!body) return EMPTY;

  // Nothing to imitate: a draft written from an unread voice is just a model's
  // own, which is the one thing this feature exists not to send.
  if (voice.profile.summary.length === 0) return EMPTY;

  const key = cacheKey(message.id, body, voice);
  if (!fresh) {
    const cached = await readCache<z.infer<typeof DraftSchema>>(key);
    if (cached) return { ...cached, source: "claude" };
  }

  if (!process.env.ANTHROPIC_API_KEY) return EMPTY;

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: zodOutputFormat(DraftSchema),
      },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            // The breakpoint sits here rather than on the email, because this
            // is the last thing that does not change. System plus voice is
            // ~1,570 tokens repeated verbatim by every draft written in this
            // voice; the email underneath is different every time, and a
            // breakpoint on it would write a fresh entry per call and never
            // read one back.
            {
              type: "text",
              text: [
                "This is how I write, read from my own sent mail:",
                JSON.stringify(describe(voice), null, 1),
              ].join("\n"),
              cache_control: { type: "ephemeral" },
            },
            {
              type: "text",
              text: [
                "Reply to this email as me:",
                `From: ${message.from} <${message.fromEmail}>`,
                `Subject: ${message.subject}`,
                `Received: ${message.receivedAt}`,
                "",
                body,
              ].join("\n"),
            },
          ],
        },
      ],
    });

    logCacheUsage("draft", response.usage);

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      console.warn("Claude did not write the draft", response.stop_reason);
      return EMPTY;
    }

    const value = {
      body: response.parsed_output.body.trim(),
      notes: response.parsed_output.notes
        .map((note) => note.trim().replace(/\.$/, ""))
        .filter(Boolean)
        .slice(0, 2),
    };
    if (!value.body) return EMPTY;

    await writeCache(key, value);
    return { ...value, source: "claude" };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.warn("ANTHROPIC_API_KEY rejected; no draft written");
    } else if (/credit balance/i.test((error as Error)?.message ?? "")) {
      // Arrives as a plain 400, so it needs matching on the message.
      console.warn("Anthropic credit balance exhausted; no draft written");
    } else if (error instanceof Anthropic.RateLimitError) {
      console.warn("Rate limited by the Claude API; no draft written");
    } else {
      console.error("Could not write the draft", error);
    }
    return EMPTY;
  }
}
